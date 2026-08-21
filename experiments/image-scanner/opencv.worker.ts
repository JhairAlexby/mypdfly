/// <reference lib="webworker" />

import { loadOpenCV, type OpenCV } from '@opencvjs/worker'

import {
  createFullImageDetection,
  getDocumentConfidence,
  getPerspectiveOutputSize,
  orderScannerCorners,
} from './geometry'
import type {
  ScannerDetection,
  ScannerPoint,
  ScannerProcessResult,
  ScannerWorkerRequest,
  ScannerWorkerResponse,
  ScannerWorkerStage,
} from './types'

type OpenCvRuntime = typeof OpenCV & {
  readonly HEAP8?: Int8Array
  readonly HEAPU8?: Uint8Array
}

type LoadedOpenCv = {
  readonly cv: OpenCvRuntime
  readonly loadMs: number
}

const workerScope = self as DedicatedWorkerGlobalScope
let openCvPromise: Promise<LoadedOpenCv> | null = null
let isProcessing = false

const getOpenCv = () => {
  if (!openCvPromise) {
    const startedAt = performance.now()
    openCvPromise = loadOpenCV().then((cv) => ({
      cv: cv as OpenCvRuntime,
      loadMs: performance.now() - startedAt,
    }))
  }

  return openCvPromise
}

const getWasmHeapBytes = (cv: OpenCvRuntime) =>
  cv.HEAPU8?.buffer.byteLength ?? cv.HEAP8?.buffer.byteLength ?? null

const getOpenCvVersion = (cv: OpenCvRuntime) => {
  const runtime = cv as unknown as {
    readonly getBuildInformation?: () => unknown
    readonly getVersionMajor?: () => number
    readonly getVersionMinor?: () => number
    readonly getVersionRevision?: () => number
    readonly getVersionString?: () => unknown
  }

  if (typeof runtime.getVersionString === 'function') {
    return String(runtime.getVersionString())
  }
  if (
    typeof runtime.getVersionMajor === 'function' &&
    typeof runtime.getVersionMinor === 'function' &&
    typeof runtime.getVersionRevision === 'function'
  ) {
    return [
      runtime.getVersionMajor(),
      runtime.getVersionMinor(),
      runtime.getVersionRevision(),
    ].join('.')
  }
  if (typeof runtime.getBuildInformation === 'function') {
    const buildInformation = String(runtime.getBuildInformation())
    const version = buildInformation.match(/OpenCV\s+([0-9.]+)/)?.[1]
    if (version) return version
  }

  return '5.0.0 (paquete local)'
}

const emitStage = (requestId: number, stage: ScannerWorkerStage) => {
  const response: ScannerWorkerResponse = {
    requestId,
    stage,
    type: 'stage',
  }
  workerScope.postMessage(response)
}

const detectDocument = (
  cv: OpenCvRuntime,
  source: OpenCV.Mat,
): ScannerDetection => {
  const grayscale = new cv.Mat()
  const blurred = new cv.Mat()
  const edges = new cv.Mat()
  const closedEdges = new cv.Mat()
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  const kernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(5, 5),
  )
  let bestArea = 0
  let bestPoints: ScannerPoint[] | null = null

  try {
    cv.cvtColor(source, grayscale, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(grayscale, blurred, new cv.Size(5, 5), 0)
    cv.Canny(blurred, edges, 45, 135)
    cv.morphologyEx(edges, closedEdges, cv.MORPH_CLOSE, kernel)
    cv.findContours(
      closedEdges,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE,
    )

    const imageArea = source.cols * source.rows
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index)
      const approximation = new cv.Mat()

      try {
        const perimeter = cv.arcLength(contour, true)
        cv.approxPolyDP(contour, approximation, perimeter * 0.02, true)
        if (approximation.rows !== 4 || !cv.isContourConvex(approximation)) {
          continue
        }

        const area = Math.abs(cv.contourArea(approximation))
        const areaRatio = area / imageArea
        if (area <= bestArea || areaRatio < 0.08 || areaRatio > 0.96) continue

        const coordinates = approximation.data32S
        bestPoints = Array.from({ length: 4 }, (_, pointIndex) => ({
          x: coordinates[pointIndex * 2],
          y: coordinates[pointIndex * 2 + 1],
        }))
        bestArea = area
      } finally {
        approximation.delete()
        contour.delete()
      }
    }

    if (!bestPoints) return createFullImageDetection(source.cols, source.rows)

    return {
      confidence: getDocumentConfidence(bestArea, imageArea),
      corners: orderScannerCorners(bestPoints),
      detected: true,
    }
  } finally {
    kernel.delete()
    hierarchy.delete()
    contours.delete()
    closedEdges.delete()
    edges.delete()
    blurred.delete()
    grayscale.delete()
  }
}

const correctPerspective = (
  cv: OpenCvRuntime,
  source: OpenCV.Mat,
  detection: ScannerDetection,
) => {
  const { height, width } = getPerspectiveOutputSize(detection.corners)
  const sourcePoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ...detection.corners.flatMap((point) => [point.x, point.y]),
  ])
  const destinationPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    width - 1,
    0,
    width - 1,
    height - 1,
    0,
    height - 1,
  ])
  const transform = cv.getPerspectiveTransform(
    sourcePoints,
    destinationPoints,
  )
  const corrected = new cv.Mat()

  try {
    cv.warpPerspective(
      source,
      corrected,
      transform,
      new cv.Size(width, height),
      cv.INTER_LINEAR,
      cv.BORDER_REPLICATE,
    )
    return corrected.clone()
  } finally {
    corrected.delete()
    transform.delete()
    destinationPoints.delete()
    sourcePoints.delete()
  }
}

const getAdaptiveBlockSize = (width: number, height: number) => {
  const maximum = Math.min(51, Math.max(3, Math.floor(Math.min(width, height) / 16)))
  return maximum % 2 === 0 ? maximum - 1 : maximum
}

const applyDocumentCleanFilter = (
  cv: OpenCvRuntime,
  corrected: OpenCV.Mat,
  benchmarkPasses: number,
) => {
  const grayscale = new cv.Mat()
  const smoothed = new cv.Mat()
  const binary = new cv.Mat()
  const output = new cv.Mat()
  const blockSize = getAdaptiveBlockSize(corrected.cols, corrected.rows)

  try {
    cv.cvtColor(corrected, grayscale, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(grayscale, smoothed, new cv.Size(3, 3), 0)

    for (let pass = 0; pass < benchmarkPasses; pass += 1) {
      cv.adaptiveThreshold(
        smoothed,
        binary,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        blockSize,
        9,
      )
    }

    cv.cvtColor(binary, output, cv.COLOR_GRAY2RGBA)
    const pixels = new Uint8ClampedArray(output.data)
    let blackPixels = 0
    let whitePixels = 0

    for (let index = 0; index < binary.data.length; index += 1) {
      if (binary.data[index] < 32) blackPixels += 1
      if (binary.data[index] > 223) whitePixels += 1
    }

    const pixelCount = Math.max(1, binary.data.length)
    return {
      height: output.rows,
      output: pixels.buffer,
      outputStats: {
        blackPixelRatio: blackPixels / pixelCount,
        whitePixelRatio: whitePixels / pixelCount,
      },
      width: output.cols,
    }
  } finally {
    output.delete()
    binary.delete()
    smoothed.delete()
    grayscale.delete()
  }
}

const processImage = async (
  request: ScannerWorkerRequest,
): Promise<ScannerProcessResult> => {
  const totalStartedAt = performance.now()
  emitStage(request.requestId, 'loading-opencv')
  const { cv, loadMs } = await getOpenCv()
  const wasmHeapBeforeBytes = getWasmHeapBytes(cv)
  const source = new cv.Mat(
    request.input.height,
    request.input.width,
    cv.CV_8UC4,
  )

  try {
    source.data.set(new Uint8Array(request.input.pixels))

    emitStage(request.requestId, 'detecting')
    const detectStartedAt = performance.now()
    const detection = detectDocument(cv, source)
    const detectMs = performance.now() - detectStartedAt

    emitStage(request.requestId, 'correcting-perspective')
    const perspectiveStartedAt = performance.now()
    const corrected = correctPerspective(cv, source, detection)
    const perspectiveMs = performance.now() - perspectiveStartedAt

    try {
      emitStage(request.requestId, 'filtering')
      const filterStartedAt = performance.now()
      const requestedPasses = request.options.benchmarkPasses ?? 1
      const benchmarkPasses = Math.min(
        80,
        Math.max(1, Math.round(requestedPasses)),
      )
      const filtered = applyDocumentCleanFilter(
        cv,
        corrected,
        benchmarkPasses,
      )
      const filterMs = performance.now() - filterStartedAt

      return {
        detection,
        filter: request.options.filter,
        height: filtered.height,
        metrics: {
          detectMs,
          filterMs,
          inputPixels: request.input.width * request.input.height,
          opencvLoadMs: loadMs,
          opencvVersion: getOpenCvVersion(cv),
          perspectiveMs,
          totalMs: performance.now() - totalStartedAt,
          wasmHeapAfterBytes: getWasmHeapBytes(cv),
          wasmHeapBeforeBytes,
        },
        output: filtered.output,
        outputStats: filtered.outputStats,
        perspectiveApplied: detection.detected,
        width: filtered.width,
      }
    } finally {
      corrected.delete()
    }
  } finally {
    source.delete()
  }
}

workerScope.onmessage = (event: MessageEvent<ScannerWorkerRequest>) => {
  const request = event.data
  if (request.type !== 'process') return

  if (isProcessing) {
    const response: ScannerWorkerResponse = {
      error: 'El worker ya está procesando otra imagen.',
      requestId: request.requestId,
      type: 'error',
    }
    workerScope.postMessage(response)
    return
  }

  isProcessing = true
  void processImage(request).then(
    (result) => {
      const response: ScannerWorkerResponse = {
        requestId: request.requestId,
        result,
        type: 'success',
      }
      workerScope.postMessage(response, [result.output])
    },
    (error: unknown) => {
      const response: ScannerWorkerResponse = {
        error:
          error instanceof Error
            ? error.message
            : 'OpenCV no pudo procesar la imagen.',
        requestId: request.requestId,
        type: 'error',
      }
      workerScope.postMessage(response)
    },
  ).finally(() => {
    isProcessing = false
  })
}
