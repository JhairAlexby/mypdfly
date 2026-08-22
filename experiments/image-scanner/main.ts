import {
  drawSyntheticDocumentFixture,
  SYNTHETIC_DOCUMENT_CORNERS,
  SYNTHETIC_FIXTURE_HEIGHT,
  SYNTHETIC_FIXTURE_WIDTH,
} from './fixture'
import {
  getBrowserCapabilities,
  measureBrowserMemory,
} from './memory'
import type {
  ImageScannerSpikeReport,
  ScannerCorners,
  ScannerInput,
  ScannerProcessResult,
  ScannerWorkerStage,
} from './types'
import {
  ImageScannerWorkerClient,
  ScannerCancelledError,
} from './worker-client'
import './styles.css'

declare global {
  interface Window {
    __IMAGE_SCANNER_SPIKE__: {
      error: string | null
      report: ImageScannerSpikeReport | null
      status: 'ready' | 'running' | 'passed' | 'failed'
    }
  }
}

const getElement = <ElementType extends HTMLElement>(id: string) => {
  const element = document.getElementById(id)
  if (!element) throw new Error(`No se encontró el elemento ${id}.`)
  return element as ElementType
}

const sourceCanvas = getElement<HTMLCanvasElement>('source-canvas')
const resultCanvas = getElement<HTMLCanvasElement>('result-canvas')
const fileInput = getElement<HTMLInputElement>('image-input')
const runButton = getElement<HTMLButtonElement>('run-suite')
const processButton = getElement<HTMLButtonElement>('process-current')
const cancelButton = getElement<HTMLButtonElement>('cancel-processing')
const resetButton = getElement<HTMLButtonElement>('reset-fixture')
const statusElement = getElement<HTMLParagraphElement>('status')
const summaryElement = getElement<HTMLDivElement>('summary')
const reportElement = getElement<HTMLPreElement>('report')
const client = new ImageScannerWorkerClient()
let currentImage = drawSyntheticDocumentFixture(sourceCanvas)
let activeController: AbortController | null = null

window.__IMAGE_SCANNER_SPIKE__ = {
  error: null,
  report: null,
  status: 'ready',
}

const formatBytes = (bytes: number | null) => {
  if (bytes === null) return 'no disponible'
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1,
    style: 'unit',
    unit: bytes >= 1024 * 1024 ? 'megabyte' : 'kilobyte',
    unitDisplay: 'short',
  }).format(bytes / (bytes >= 1024 * 1024 ? 1024 * 1024 : 1024))
}

const getMemoryDelta = (
  before: { readonly bytes: number | null },
  after: { readonly bytes: number | null },
) =>
  before.bytes !== null && after.bytes !== null
    ? after.bytes - before.bytes
    : null

const setBusy = (busy: boolean) => {
  runButton.disabled = busy
  processButton.disabled = busy
  resetButton.disabled = busy
  fileInput.disabled = busy
  cancelButton.disabled = !busy
}

const setStatus = (message: string, state: 'idle' | 'working' | 'success' | 'error') => {
  statusElement.textContent = message
  statusElement.dataset.state = state
}

const toScannerInput = (image: ImageData): ScannerInput => ({
  height: image.height,
  pixels: new Uint8ClampedArray(image.data).buffer,
  width: image.width,
})

const drawDetection = (image: ImageData, corners: ScannerCorners) => {
  const context = sourceCanvas.getContext('2d')
  if (!context) throw new Error('No se pudo dibujar la detección.')

  context.putImageData(image, 0, 0)
  context.save()
  context.strokeStyle = '#22c55e'
  context.fillStyle = '#0f172a'
  context.lineWidth = Math.max(4, sourceCanvas.width / 260)
  context.beginPath()
  context.moveTo(corners[0].x, corners[0].y)
  corners.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  context.closePath()
  context.stroke()
  corners.forEach((point, index) => {
    context.beginPath()
    context.arc(point.x, point.y, 13, 0, Math.PI * 2)
    context.fillStyle = '#22c55e'
    context.fill()
    context.fillStyle = '#052e16'
    context.font = 'bold 16px sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(String(index + 1), point.x, point.y)
  })
  context.restore()
}

const drawResult = (result: ScannerProcessResult) => {
  resultCanvas.width = result.width
  resultCanvas.height = result.height
  const context = resultCanvas.getContext('2d')
  if (!context) throw new Error('No se pudo dibujar el resultado filtrado.')

  context.putImageData(
    new ImageData(
      new Uint8ClampedArray(result.output),
      result.width,
      result.height,
    ),
    0,
    0,
  )
}

const withoutOutput = (result: ScannerProcessResult) => {
  return {
    detection: result.detection,
    filter: result.filter,
    height: result.height,
    metrics: result.metrics,
    outputStats: result.outputStats,
    perspectiveApplied: result.perspectiveApplied,
    width: result.width,
  }
}

const getCornerMeanError = (
  actual: ScannerCorners,
  expected: ScannerCorners,
) =>
  actual.reduce(
    (total, point, index) =>
      total + Math.hypot(point.x - expected[index].x, point.y - expected[index].y),
    0,
  ) / actual.length

const processImage = async (
  image: ImageData,
  benchmarkPasses = 1,
  onStage?: (stage: ScannerWorkerStage) => void,
) => {
  const controller = new AbortController()
  activeController = controller

  try {
    return await client.process(
      toScannerInput(image),
      { benchmarkPasses, filter: 'document-clean' },
      {
        onStage: (stage) => {
          setStatus(`Worker local: ${stage}`, 'working')
          onStage?.(stage)
        },
        signal: controller.signal,
      },
    )
  } finally {
    if (activeController === controller) activeController = null
  }
}

const processCurrentImage = async () => {
  setBusy(true)
  setStatus('Preparando OpenCV.js local…', 'working')

  try {
    const result = await processImage(currentImage)
    drawDetection(currentImage, result.detection.corners)
    drawResult(result)
    summaryElement.textContent = [
      `OpenCV ${result.metrics.opencvVersion}`,
      `detección ${result.detection.detected ? 'correcta' : 'con fallback'}`,
      `confianza ${(result.detection.confidence * 100).toFixed(1)}%`,
      `salida ${result.width}×${result.height}`,
      `tiempo ${result.metrics.totalMs.toFixed(1)} ms`,
    ].join(' · ')
    reportElement.textContent = JSON.stringify(withoutOutput(result), null, 2)
    setStatus('Detección, perspectiva y filtro completados.', 'success')
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'El procesamiento falló.'
    setStatus(message, error instanceof ScannerCancelledError ? 'idle' : 'error')
  } finally {
    setBusy(false)
  }
}

const runSpikeSuite = async () => {
  setBusy(true)
  window.__IMAGE_SCANNER_SPIKE__ = {
    error: null,
    report: null,
    status: 'running',
  }
  currentImage = drawSyntheticDocumentFixture(sourceCanvas)
  resultCanvas.width = 1
  resultCanvas.height = 1
  setStatus('Ejecutando suite reproducible…', 'working')

  try {
    const capabilities = getBrowserCapabilities()
    const beforeMemory = await measureBrowserMemory()
    const normalResult = await processImage(currentImage)
    drawDetection(currentImage, normalResult.detection.corners)
    drawResult(normalResult)
    const afterFirstRunMemory = await measureBrowserMemory()

    const repeatedRunDurationsMs: number[] = []
    const repeatedWasmHeapBytes: Array<number | null> = []
    for (let iteration = 0; iteration < 5; iteration += 1) {
      const repeatedResult = await processImage(currentImage)
      repeatedRunDurationsMs.push(repeatedResult.metrics.totalMs)
      repeatedWasmHeapBytes.push(repeatedResult.metrics.wasmHeapAfterBytes)
    }
    const afterRepeatedRunsMemory = await measureBrowserMemory()

    let stageReached: ScannerWorkerStage | null = null
    let cancellationStartedAt = 0
    const cancellationController = new AbortController()
    activeController = cancellationController
    const longProcessing = client.process(
      toScannerInput(currentImage),
      { benchmarkPasses: 80, filter: 'document-clean' },
      {
        onStage: (stage) => {
          stageReached = stage
          setStatus(`Prueba de cancelación: ${stage}`, 'working')
          if (stage === 'filtering') {
            cancellationStartedAt = performance.now()
            cancellationController.abort()
          }
        },
        signal: cancellationController.signal,
      },
    )

    let cancelled = false
    try {
      await longProcessing
    } catch (error) {
      cancelled = error instanceof ScannerCancelledError
      if (!cancelled) throw error
    } finally {
      if (activeController === cancellationController) activeController = null
    }
    const cancellationLatencyMs = cancellationStartedAt
      ? performance.now() - cancellationStartedAt
      : Number.POSITIVE_INFINITY

    const recoveryResult = await processImage(currentImage)
    const recoverySucceeded =
      recoveryResult.detection.detected && recoveryResult.output.byteLength > 0
    client.dispose()
    await new Promise((resolve) => setTimeout(resolve, 250))
    const afterWorkerTerminationMemory = await measureBrowserMemory()
    const cornerMeanErrorPx = getCornerMeanError(
      normalResult.detection.corners,
      SYNTHETIC_DOCUMENT_CORNERS,
    )
    const cornerMeanErrorRatio =
      cornerMeanErrorPx /
      Math.hypot(SYNTHETIC_FIXTURE_WIDTH, SYNTHETIC_FIXTURE_HEIGHT)
    const passed =
      capabilities.worker &&
      capabilities.wasm &&
      normalResult.detection.detected &&
      normalResult.perspectiveApplied &&
      cornerMeanErrorRatio < 0.06 &&
      normalResult.outputStats.blackPixelRatio > 0.01 &&
      normalResult.outputStats.whitePixelRatio > 0.5 &&
      cancelled &&
      recoverySucceeded
    const report: ImageScannerSpikeReport = {
      accuracy: {
        cornerMeanErrorPx,
        cornerMeanErrorRatio,
      },
      capabilities,
      cancellation: {
        cancelled,
        latencyMs: cancellationLatencyMs,
        recoverySucceeded,
        stageReached,
      },
      generatedAt: new Date().toISOString(),
      memory: {
        afterFirstRun: afterFirstRunMemory,
        afterRepeatedRuns: afterRepeatedRunsMemory,
        afterWorkerTermination: afterWorkerTerminationMemory,
        before: beforeMemory,
        firstRunDeltaBytes: getMemoryDelta(beforeMemory, afterFirstRunMemory),
        repeatedRunsDeltaBytes: getMemoryDelta(
          afterFirstRunMemory,
          afterRepeatedRunsMemory,
        ),
        retainedAfterTerminationBytes: getMemoryDelta(
          beforeMemory,
          afterWorkerTerminationMemory,
        ),
        repeatedWasmHeapBytes,
      },
      normalRun: withoutOutput(normalResult),
      passed,
      repeatedRunDurationsMs,
      userAgent: navigator.userAgent,
    }

    window.__IMAGE_SCANNER_SPIKE__ = {
      error: passed ? null : 'La suite terminó pero no cumplió todos los criterios.',
      report,
      status: passed ? 'passed' : 'failed',
    }
    reportElement.textContent = JSON.stringify(report, null, 2)
    summaryElement.textContent = [
      `OpenCV ${normalResult.metrics.opencvVersion}`,
      `error de esquinas ${cornerMeanErrorPx.toFixed(1)} px`,
      `WASM ${formatBytes(normalResult.metrics.wasmHeapAfterBytes)}`,
      `worker ${formatBytes(report.memory.firstRunDeltaBytes)}`,
      `retenida ${formatBytes(report.memory.retainedAfterTerminationBytes)}`,
      `cancelación ${cancellationLatencyMs.toFixed(1)} ms`,
    ].join(' · ')
    setStatus(
      passed
        ? 'Spike aprobado: el flujo local completo y la recuperación pasaron.'
        : 'El spike terminó con criterios pendientes. Revisa el reporte.',
      passed ? 'success' : 'error',
    )
  } catch (error) {
    client.dispose()
    const message = error instanceof Error ? error.message : 'La suite falló.'
    window.__IMAGE_SCANNER_SPIKE__ = {
      error: message,
      report: null,
      status: 'failed',
    }
    reportElement.textContent = JSON.stringify({ error: message }, null, 2)
    setStatus(message, 'error')
  } finally {
    setBusy(false)
  }
}

const loadSelectedImage = async (file: File) => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const maximumEdge = 2048
  const scale = Math.min(1, maximumEdge / Math.max(bitmap.width, bitmap.height))
  sourceCanvas.width = Math.max(1, Math.round(bitmap.width * scale))
  sourceCanvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = sourceCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo preparar la imagen seleccionada.')

  try {
    context.drawImage(bitmap, 0, 0, sourceCanvas.width, sourceCanvas.height)
    currentImage = context.getImageData(
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    )
    resultCanvas.width = 1
    resultCanvas.height = 1
    reportElement.textContent = ''
    summaryElement.textContent = `${file.name} · ${sourceCanvas.width}×${sourceCanvas.height}`
    setStatus('Imagen local preparada. Puedes procesarla.', 'idle')
  } finally {
    bitmap.close()
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  fileInput.value = ''
  if (!file) return

  void loadSelectedImage(file).catch((error: unknown) => {
    setStatus(
      error instanceof Error ? error.message : 'No se pudo abrir la imagen.',
      'error',
    )
  })
})
runButton.addEventListener('click', () => void runSpikeSuite())
processButton.addEventListener('click', () => void processCurrentImage())
cancelButton.addEventListener('click', () => activeController?.abort())
resetButton.addEventListener('click', () => {
  currentImage = drawSyntheticDocumentFixture(sourceCanvas)
  resultCanvas.width = 1
  resultCanvas.height = 1
  reportElement.textContent = ''
  summaryElement.textContent = 'Fixture sintético reproducible listo.'
  setStatus('Laboratorio listo.', 'idle')
})
window.addEventListener('beforeunload', () => client.dispose())

summaryElement.textContent = 'Fixture sintético reproducible listo.'
setStatus('Laboratorio listo.', 'idle')
setBusy(false)

if (new URLSearchParams(window.location.search).get('autorun') === '1') {
  requestAnimationFrame(() => void runSpikeSuite())
}
