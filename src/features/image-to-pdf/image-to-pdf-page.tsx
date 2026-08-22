import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChangeEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Crosshair,
  FileDown,
  FileImage,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  RotateCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  WandSparkles,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatFileSize } from '@/lib/files/format-file-size'
import { downloadBlob } from '@/lib/files/download'
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_TOTAL_IMAGE_PIXELS,
  applyImageFilterToAll,
  getImagePixelCount,
  moveImage,
  removeImage,
  rotateImage,
  setImageFilter,
  setScannerCorners,
  setScannerState,
  type ImageDocumentItem,
  validateImageFile,
} from './core/document'
import {
  getImageFilterCss,
  getImageFilterDefinition,
  IMAGE_FILTERS,
  type ImageFilter,
} from './core/image-filters'
import {
  createImagesPdf,
  isPdfExportCancelled,
  type PdfExportProgress,
  type PdfFitMode,
  type PdfMarginMm,
  type PdfPagePreset,
} from './core/pdf-export'
import type {
  ImageScannerState,
  ScannerCorners,
  ScannerWorkerStage,
} from './core/scanner/types'
import {
  clampScannerPoint,
  createImageScannerState,
  isScannerQuadrilateralValid,
  scaleScannerCorners,
} from './core/scanner/geometry'
import { renderPerspectiveCanvas } from './core/scanner/perspective'
import { decodeImageFile, type DecodedImageSource } from './core/image-source'
import type { ImageScannerWorkerClient } from '../../../experiments/image-scanner/worker-client'

type ImageToPdfPageProps = {
  readonly homeHref?: string
}

const createImageDocumentItem = async (file: File): Promise<ImageDocumentItem> => {
  const image = await decodeImageFile(file)
  const previewUrl = image.previewUrl ?? URL.createObjectURL(file)
  try {
    return {
      file,
      filter: 'original',
      height: image.height,
      id: crypto.randomUUID(),
      previewUrl,
      rotation: 0,
      scanner: createImageScannerState(image.width, image.height),
      width: image.width,
    }
  } catch (error) {
    if (!image.previewUrl) URL.revokeObjectURL(previewUrl)
    throw error
  } finally {
    image.close()
  }
}

const formatImageLimits = () =>
  `Hasta ${MAX_IMAGE_COUNT} imágenes · ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} por imagen · ${formatFileSize(MAX_TOTAL_IMAGE_SIZE_BYTES)} en total · ${Math.round(MAX_IMAGE_PIXELS / 1_000_000)} MP por imagen · ${Math.round(MAX_TOTAL_IMAGE_PIXELS / 1_000_000)} MP por documento`

type ExportState =
  | { readonly status: 'idle'; readonly progress: 0 }
  | ({ readonly status: 'running' | 'cancelling' } & PdfExportProgress)
  | { readonly status: 'success'; readonly progress: 1 }
  | { readonly status: 'cancelled' | 'error'; readonly progress: number }

const initialExportState: ExportState = { progress: 0, status: 'idle' }

const createScannerInput = async (file: File) => {
  const image = await decodeImageFile(file)
  const maximumEdge = 1600
  const scale = Math.min(1, maximumEdge / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    image.close()
    throw new Error('No se pudo preparar la imagen para detectar el documento.')
  }

  try {
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    return {
      height: canvas.height,
      input: {
        height: canvas.height,
        pixels: new Uint8ClampedArray(pixels.data).buffer,
        width: canvas.width,
      },
      width: canvas.width,
    }
  } finally {
    canvas.width = 1
    canvas.height = 1
    image.close()
  }
}

const scannerCornerLabels = [
  'Esquina superior izquierda',
  'Esquina superior derecha',
  'Esquina inferior derecha',
  'Esquina inferior izquierda',
] as const

function ScannerPerspectivePreview({ item }: { readonly item: ImageDocumentItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let disposed = false
    let loadedImage: DecodedImageSource | null = null
    let perspective: Awaited<ReturnType<typeof renderPerspectiveCanvas>> | null = null
    const controller = new AbortController()

    const clearCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = 1
      canvas.height = 1
    }

    const render = async () => {
      if (!item.scanner.active) {
        clearCanvas()
        return
      }

      try {
        loadedImage = await decodeImageFile(item.file, controller.signal)
        perspective = await renderPerspectiveCanvas(
          loadedImage.source,
          loadedImage.width,
          loadedImage.height,
          item.scanner.corners,
          { signal: controller.signal },
        )
        if (disposed) return

        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (!canvas || !context || !perspective) return
        canvas.width = perspective.canvas.width
        canvas.height = perspective.canvas.height
        context.drawImage(perspective.canvas, 0, 0)
      } catch {
        if (!disposed) clearCanvas()
      } finally {
        if (perspective) {
          perspective.canvas.width = 1
          perspective.canvas.height = 1
        }
        loadedImage?.close()
      }
    }

    void render()
    return () => {
      disposed = true
      controller.abort()
    }
  }, [item.file, item.scanner.active, item.scanner.corners])

  return (
    <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4 sm:min-h-72">
      {item.scanner.active ? (
        <canvas
          ref={canvasRef}
          aria-label={`Vista previa de perspectiva de ${item.file.name}`}
          className="max-h-72 max-w-full rounded-lg object-contain shadow-sm"
          style={{
            filter: getImageFilterCss(item.filter),
            transform: `rotate(${item.rotation}deg)`,
          }}
        />
      ) : (
        <p className="max-w-xs text-center text-xs leading-5 text-slate-500">
          Ajusta las cuatro esquinas y pulsa “Aplicar perspectiva” para ver el resultado enderezado.
        </p>
      )}
    </div>
  )
}

export function ImageToPdfPage({ homeHref = '/' }: ImageToPdfPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<readonly ImageDocumentItem[]>([])
  const [items, setItems] = useState<readonly ImageDocumentItem[]>([])
  const [errors, setErrors] = useState<readonly string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [activeFilterItemId, setActiveFilterItemId] = useState<string | null>(null)
  const [pagePreset, setPagePreset] = useState<PdfPagePreset>('a4')
  const [marginMm, setMarginMm] = useState<PdfMarginMm>(10)
  const [fitMode, setFitMode] = useState<PdfFitMode>('contain')
  const [exportState, setExportState] = useState<ExportState>(initialExportState)
  const [exportError, setExportError] = useState('')
  const [activeScannerItemId, setActiveScannerItemId] = useState<string | null>(null)
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'detecting' | 'error'>('idle')
  const [scannerStage, setScannerStage] = useState<ScannerWorkerStage | null>(null)
  const [scannerMessage, setScannerMessage] = useState('')
  const [draggingCornerIndex, setDraggingCornerIndex] = useState<number | null>(null)
  const exportControllerRef = useRef<AbortController | null>(null)
  const scannerControllerRef = useRef<AbortController | null>(null)
  const scannerClientRef = useRef<ImageScannerWorkerClient | null>(null)

  const totalBytes = useMemo(
    () => items.reduce((total, item) => total + item.file.size, 0),
    [items],
  )

  const isExporting =
    exportState.status === 'running' || exportState.status === 'cancelling'
  const isScanning = scannerStatus === 'detecting'
  const isBusy = isExporting || isScanning

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(
    () => () => {
      exportControllerRef.current?.abort()
      scannerControllerRef.current?.abort()
      scannerClientRef.current?.dispose()
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    },
    [],
  )

  const openFilePicker = () => {
    if (!isReading && !isBusy) inputRef.current?.click()
  }

  const addFiles = async (fileList: FileList | readonly File[]) => {
    const selectedFiles = Array.from(fileList)
    if (!selectedFiles.length || isReading || isBusy) return

    setIsReading(true)
    const nextItems = [...items]
    let nextTotalBytes = totalBytes
    let nextTotalPixels = nextItems.reduce(
      (total, item) => total + getImagePixelCount(item.width, item.height),
      0,
    )
    const nextErrors: string[] = []

    for (const file of selectedFiles) {
      const validation = validateImageFile(file, {
        existingCount: nextItems.length,
        existingFiles: nextItems.map((item) => item.file),
        existingTotalBytes: nextTotalBytes,
      })

      if (!validation.valid) {
        nextErrors.push(`${file.name}: ${validation.message}`)
        continue
      }

      try {
        const item = await createImageDocumentItem(file)
        const dimensionValidation = validateImageFile(file, {
          existingCount: nextItems.length,
          existingFiles: nextItems.map((candidate) => candidate.file),
          existingTotalBytes: nextTotalBytes,
          existingTotalPixels: nextTotalPixels,
          height: item.height,
          width: item.width,
        })
        if (!dimensionValidation.valid) {
          URL.revokeObjectURL(item.previewUrl)
          nextErrors.push(`${file.name}: ${dimensionValidation.message}`)
          continue
        }
        nextItems.push(item)
        nextTotalBytes += file.size
        nextTotalPixels += getImagePixelCount(item.width, item.height)
      } catch {
        nextErrors.push(`${file.name}: la imagen no se pudo leer en este navegador.`)
      }
    }

    setItems(nextItems)
    setErrors(nextErrors)
    setIsReading(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFilePicker()
    }
  }

  const removeItem = (id: string) => {
    if (isBusy) return
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return
    URL.revokeObjectURL(item.previewUrl)
    setItems(removeImage(items, id))
  }

  const rotateItem = (id: string) => {
    if (isBusy) return
    setItems(
      items.map((item) => (item.id === id ? rotateImage(item) : item)),
    )
  }

  const moveItem = (id: string, direction: -1 | 1) => {
    if (isBusy) return
    const currentIndex = items.findIndex((item) => item.id === id)
    setItems(moveImage(items, currentIndex, currentIndex + direction))
  }

  const updateItemFilter = (id: string, filter: ImageFilter) => {
    if (isBusy) return
    setItems(setImageFilter(items, id, filter))
  }

  const activeFilterItem =
    items.find((item) => item.id === activeFilterItemId) ?? items[0]
  const activeFilter = activeFilterItem?.filter ?? 'original'
  const activeScannerItem =
    items.find((item) => item.id === activeScannerItemId) ?? items[0]

  const applyActiveFilterToAll = () => {
    if (!activeFilterItem || isBusy) return
    setItems(applyImageFilterToAll(items, activeFilter))
  }

  const clearDocument = () => {
    if (isBusy) return
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setItems([])
    setErrors([])
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    event.dataTransfer.effectAllowed = 'move'
    setDraggedId(id)
  }

  const handleDropOnItem = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    if (isBusy) return
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const fromIndex = items.findIndex((item) => item.id === draggedId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    setItems(moveImage(items, fromIndex, toIndex))
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleExportProgress = (progress: PdfExportProgress) => {
    setExportState((currentState) =>
      currentState.status === 'cancelling'
        ? { ...progress, status: 'cancelling' }
        : { ...progress, status: 'running' },
    )
  }

  const exportPdf = async () => {
    if (!items.length || isBusy) return

    const controller = new AbortController()
    exportControllerRef.current = controller
    setExportError('')
    setExportState({
      currentPage: 0,
      progress: 0,
      stage: 'rendering',
      status: 'running',
      totalPages: items.length,
    })

    try {
      const blob = await createImagesPdf(items, {
        fitMode,
        marginMm,
        onProgress: handleExportProgress,
        pagePreset,
        signal: controller.signal,
      })
      downloadBlob(blob, 'imagenes-a-pdf.pdf')
      setExportState({ progress: 1, status: 'success' })
    } catch (error) {
      if (isPdfExportCancelled(error)) {
        setExportState({ progress: 0, status: 'cancelled' })
      } else {
        setExportError(
          error instanceof Error
            ? error.message
            : 'No se pudo generar el PDF.',
        )
        setExportState({ progress: 0, status: 'error' })
      }
    } finally {
      if (exportControllerRef.current === controller) {
        exportControllerRef.current = null
      }
    }
  }

  const cancelExport = () => {
    if (!isExporting) return
    setExportState((currentState) => {
      if (currentState.status !== 'running' && currentState.status !== 'cancelling') {
        return currentState
      }
      return { ...currentState, status: 'cancelling' }
    })
    exportControllerRef.current?.abort()
  }

  const updateScannerState = (id: string, scanner: ImageScannerState) => {
    setItems((currentItems) => setScannerState(currentItems, id, scanner))
  }

  const markScannerCornersAsManual = (perspectiveActive: boolean) => {
    setScannerStatus('idle')
    setScannerStage(null)
    setScannerMessage(
      perspectiveActive
        ? 'Esquinas ajustadas manualmente; la perspectiva continúa aplicada.'
        : 'Esquinas ajustadas manualmente. Pulsa “Aplicar perspectiva” para activarla.',
    )
  }

  const handleScannerPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeScannerItem || draggingCornerIndex === null || isBusy) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const point = clampScannerPoint(
      {
        x: ((event.clientX - bounds.left) / bounds.width) * activeScannerItem.width,
        y: ((event.clientY - bounds.top) / bounds.height) * activeScannerItem.height,
      },
      activeScannerItem.width,
      activeScannerItem.height,
    )
    setItems((currentItems) => {
      const item = currentItems.find((candidate) => candidate.id === activeScannerItem.id)
      if (!item) return currentItems
      const corners = item.scanner.corners.map((candidate, candidateIndex) =>
        candidateIndex === draggingCornerIndex ? point : candidate,
      ) as unknown as ScannerCorners
      return setScannerCorners(currentItems, item.id, corners)
    })
    markScannerCornersAsManual(activeScannerItem.scanner.active)
  }

  const handleScannerPointerUp = () => setDraggingCornerIndex(null)

  const resetScanner = () => {
    if (!activeScannerItem || isBusy) return
    updateScannerState(
      activeScannerItem.id,
      createImageScannerState(activeScannerItem.width, activeScannerItem.height),
    )
    setScannerMessage('Esquinas restablecidas. Puedes ajustarlas manualmente.')
    setScannerStatus('idle')
    setScannerStage(null)
  }

  const toggleScannerPerspective = () => {
    if (!activeScannerItem || isBusy) return
    if (activeScannerItem.scanner.active) {
      updateScannerState(activeScannerItem.id, {
        ...activeScannerItem.scanner,
        active: false,
      })
      setScannerMessage('Perspectiva quitada; el PDF usará la imagen original.')
      return
    }
    if (!isScannerQuadrilateralValid(activeScannerItem.scanner.corners)) {
      setScannerMessage('Las esquinas deben formar un cuadrilátero válido.')
      setScannerStatus('error')
      return
    }
    updateScannerState(activeScannerItem.id, {
      ...activeScannerItem.scanner,
      active: true,
      detected: false,
    })
    setScannerStatus('idle')
    setScannerMessage('Perspectiva aplicada a esta página.')
  }

  const cancelScannerDetection = () => {
    if (!isScanning) return
    scannerControllerRef.current?.abort()
    scannerClientRef.current?.cancel()
  }

  const detectScannerDocument = async () => {
    if (!activeScannerItem || isBusy) return

    const itemId = activeScannerItem.id
    const controller = new AbortController()
    scannerControllerRef.current = controller
    setScannerStatus('detecting')
    setScannerStage('loading-opencv')
    setScannerMessage('Preparando detección local…')

    try {
      const { ImageScannerWorkerClient, ScannerCancelledError } = await import(
        '../../../experiments/image-scanner/worker-client'
      )
      const client = new ImageScannerWorkerClient()
      scannerClientRef.current = client
      const prepared = await createScannerInput(activeScannerItem.file)
      if (controller.signal.aborted) throw new ScannerCancelledError()

      const result = await client.process(
        prepared.input,
        { filter: 'document-clean' },
        {
          onStage: (stage) => {
            setScannerStage(stage)
            setScannerMessage(
              {
                'loading-opencv': 'Cargando el motor local…',
                detecting: 'Buscando los bordes del documento…',
                'correcting-perspective': 'Calculando la perspectiva…',
                filtering: 'Preparando la vista escaneada…',
              }[stage],
            )
          },
          signal: controller.signal,
        },
      )
      const corners = scaleScannerCorners(
        result.detection.corners,
        prepared.width,
        prepared.height,
        activeScannerItem.width,
        activeScannerItem.height,
      )
      const detected = result.detection.detected && isScannerQuadrilateralValid(corners)
      updateScannerState(itemId, {
        active: detected,
        confidence: result.detection.confidence,
        corners,
        detected,
      })
      setScannerStatus('idle')
      setScannerStage(null)
      setScannerMessage(
        detected
          ? `Documento detectado con ${Math.round(result.detection.confidence * 100)}% de confianza. Revisa las esquinas antes de exportar.`
          : 'No se encontró un documento con suficiente confianza. Revisa las esquinas manualmente.',
      )
    } catch (error) {
      const wasCancelled = error instanceof Error && error.name === 'ScannerCancelledError'
      setScannerStage(null)
      setScannerStatus(wasCancelled ? 'idle' : 'error')
      setScannerMessage(
        wasCancelled
          ? 'Detección cancelada; las esquinas manuales se conservaron.'
          : error instanceof Error
            ? error.message
            : 'La detección automática no está disponible en este navegador.',
      )
    } finally {
      if (scannerClientRef.current) {
        scannerClientRef.current.dispose()
        scannerClientRef.current = null
      }
      if (scannerControllerRef.current === controller) {
        scannerControllerRef.current = null
      }
      setScannerStatus((currentStatus) =>
        currentStatus === 'detecting' ? 'idle' : currentStatus,
      )
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={homeHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950 focus-visible:text-slate-950 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al inicio
        </a>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Procesamiento local
        </span>
      </div>

      <Card className="w-full gap-0 overflow-hidden rounded-3xl border-0 bg-white py-0 shadow-[0_28px_80px_rgba(39,45,76,0.12)] ring-1 ring-slate-200/90">
        <CardHeader className="border-b border-slate-200 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff0ed] text-[#ed4c38]">
              <FileImage className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
                Imágenes a PDF
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-sm leading-6 sm:text-base">
                Carga tus imágenes, organiza el documento y configura cada página antes de exportarlo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-5 py-5 sm:px-7 sm:py-7">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            onChange={handleFileChange}
            aria-label="Seleccionar imágenes para convertir a PDF"
          />

          {items.length === 0 && (
            <div
              data-testid="image-upload-zone"
              role="button"
              tabIndex={0}
              className={`group grid min-h-80 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center outline-none transition sm:min-h-96 sm:px-8 ${
                isDragging
                  ? 'scale-[1.01] border-[#ff7867] bg-[#fff9f7] ring-4 ring-[#ff5a45]/10'
                  : 'hover:border-[#ff7867] hover:bg-[#fff9f7] focus-visible:border-[#ff7867] focus-visible:ring-4 focus-visible:ring-[#ff5a45]/10'
              } ${isReading ? 'pointer-events-none opacity-70' : ''}`}
              onClick={openFilePicker}
              onKeyDown={handleUploadKeyDown}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setIsDragging(false)
                }
              }}
              onDrop={handleDrop}
              aria-busy={isReading}
              aria-label="Seleccionar o arrastrar imágenes para convertir a PDF"
            >
              <div>
                <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] transition-transform duration-300 group-hover:-translate-y-1">
                  {isReading ? (
                    <LoaderCircle className="size-9 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileImage className="size-9" strokeWidth={1.7} aria-hidden="true" />
                  )}
                  <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
                    <UploadCloud className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-6 text-lg font-semibold text-slate-950 sm:text-xl">
                  {isReading ? 'Preparando imágenes…' : 'Suelta tus imágenes aquí'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  o selecciónalas desde tu dispositivo
                </p>
                {!isReading && (
                  <Button
                    type="button"
                    size="lg"
                    className="mt-6 h-11 rounded-xl bg-slate-950 px-5 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    onClick={(event) => {
                      event.stopPropagation()
                      openFilePicker()
                    }}
                  >
                    <ImagePlus data-icon="inline-start" aria-hidden="true" />
                    Seleccionar imágenes
                  </Button>
                )}
                <p className="mt-5 text-xs text-slate-400">
                  JPEG · PNG · WebP · AVIF · {formatImageLimits()}
                </p>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTitle>No se añadieron todas las imágenes</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1 pl-4">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {items.length > 0 && (
            <section aria-labelledby="image-pages-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="image-pages-title" className="text-base font-semibold text-slate-950">
                    {items.length} {items.length === 1 ? 'página' : 'páginas'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatFileSize(totalBytes)} · arrastra o usa las flechas para ordenar
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg bg-white"
                    onClick={openFilePicker}
                    disabled={isReading || isBusy}
                  >
                    <ImagePlus data-icon="inline-start" aria-hidden="true" />
                    Añadir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-slate-500 hover:text-red-700"
                    onClick={clearDocument}
                  >
                    Vaciar
                  </Button>
                </div>
              </div>

              <div
                data-testid="image-pages-grid"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((item, index) => (
                  <article
                    key={item.id}
                    draggable
                    className={`group overflow-hidden rounded-2xl border bg-white transition ${
                      dragOverId === item.id
                        ? 'border-[#ff7867] ring-4 ring-[#ff5a45]/10'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                    onDragStart={(event) => handleDragStart(event, item.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverId(item.id)
                    }}
                    onDrop={(event) => handleDropOnItem(event, item.id)}
                    onDragEnd={() => {
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100 p-3">
                      <img
                        src={item.previewUrl}
                        alt={`Vista previa de ${item.file.name}`}
                        className="max-h-full max-w-full rounded-lg object-contain shadow-sm transition-transform duration-300"
                        style={{
                          filter: getImageFilterCss(item.filter),
                          transform: `rotate(${item.rotation}deg)`,
                        }}
                      />
                      <span className="absolute top-3 left-3 inline-flex size-7 items-center justify-center rounded-full bg-slate-950/80 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-sm" title="Arrastrar para ordenar">
                        <GripVertical className="size-4" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="space-y-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.width} × {item.height} · {formatFileSize(item.file.size)}
                          {item.rotation > 0 ? ` · girada ${item.rotation}°` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-1 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => moveItem(item.id, -1)}
                            disabled={index === 0 || isBusy}
                            aria-label={`Mover ${item.file.name} arriba`}
                            title="Mover arriba"
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => moveItem(item.id, 1)}
                            disabled={index === items.length - 1 || isBusy}
                            aria-label={`Mover ${item.file.name} abajo`}
                            title="Mover abajo"
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => rotateItem(item.id)}
                            disabled={isBusy}
                            aria-label={`Rotar ${item.file.name}`}
                            title="Rotar 90°"
                          >
                            <RotateCw aria-hidden="true" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeItem(item.id)}
                          disabled={isBusy}
                          aria-label={`Eliminar ${item.file.name}`}
                          title="Eliminar imagen"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {items.length > 0 && activeFilterItem && (
            <section
              aria-labelledby="image-filters-title"
              data-testid="image-filters"
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#e84c38] shadow-sm ring-1 ring-slate-200">
                  <WandSparkles className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="image-filters-title" className="text-sm font-semibold text-slate-950">
                    Filtros de imagen
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Son ajustes no destructivos: el archivo original permanece intacto y solo se aplican al PDF.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                <div className="min-w-0">
                  <label className="grid max-w-sm gap-1.5 text-xs font-medium text-slate-600">
                    Vista previa de
                    <select
                      aria-label="Página para previsualizar filtro"
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
                      value={activeFilterItem.id}
                      onChange={(event) => setActiveFilterItemId(event.target.value)}
                      disabled={isBusy}
                    >
                      {items.map((item, index) => (
                        <option key={item.id} value={item.id}>
                          Página {index + 1} · {item.file.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 flex min-h-52 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-4 sm:min-h-64">
                    <img
                      src={activeFilterItem.previewUrl}
                      alt={`Vista previa de ${getImageFilterDefinition(activeFilter).label} para ${activeFilterItem.file.name}`}
                      className="max-h-64 max-w-full rounded-lg object-contain shadow-sm"
                      style={{
                        filter: getImageFilterCss(activeFilter),
                        transform: `rotate(${activeFilterItem.rotation}deg)`,
                      }}
                    />
                  </div>
                </div>

                <div className="flex min-w-0 flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-600">Filtro de la página activa</p>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Filtros disponibles">
                      {IMAGE_FILTERS.map((definition) => (
                        <Button
                          key={definition.id}
                          type="button"
                          size="sm"
                          variant={activeFilter === definition.id ? 'default' : 'outline'}
                          className="rounded-lg"
                          aria-pressed={activeFilter === definition.id}
                          onClick={() => updateItemFilter(activeFilterItem.id, definition.id)}
                          disabled={isBusy}
                        >
                          {definition.label}
                        </Button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {getImageFilterDefinition(activeFilter).description}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl bg-white sm:w-auto sm:self-start"
                    onClick={applyActiveFilterToAll}
                    disabled={isBusy || items.every((item) => item.filter === activeFilter)}
                  >
                    Aplicar a todas
                  </Button>
                </div>
              </div>
            </section>
          )}

          {items.length > 0 && activeScannerItem && (
            <section
              aria-labelledby="scanner-mode-title"
              data-testid="scanner-mode"
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#e84c38] shadow-sm ring-1 ring-slate-200">
                  <ScanLine className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="scanner-mode-title" className="text-sm font-semibold text-slate-950">
                    Modo escáner
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Ajusta las esquinas manualmente o usa detección local. La perspectiva se aplica solo al PDF.
                  </p>
                </div>
              </div>

              <label className="mb-4 grid max-w-sm gap-1.5 text-xs font-medium text-slate-600">
                Página para escanear
                <select
                  aria-label="Página para escanear"
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
                  value={activeScannerItem.id}
                  onChange={(event) => setActiveScannerItemId(event.target.value)}
                  disabled={isBusy}
                >
                  {items.map((item, index) => (
                    <option key={item.id} value={item.id}>
                      Página {index + 1} · {item.file.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
                <div className="min-w-0">
                  <div
                    className="relative mx-auto max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm"
                    style={{ aspectRatio: `${activeScannerItem.width} / ${activeScannerItem.height}` }}
                  >
                    <img
                      src={activeScannerItem.previewUrl}
                      alt={`Editor de esquinas para ${activeScannerItem.file.name}`}
                      className="absolute inset-0 size-full object-fill opacity-90"
                    />
                    <svg
                      viewBox={`0 0 ${activeScannerItem.width} ${activeScannerItem.height}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 size-full touch-none"
                      role="img"
                      aria-label="Editor manual de las cuatro esquinas del documento"
                      onPointerMove={handleScannerPointerMove}
                      onPointerUp={handleScannerPointerUp}
                      onPointerCancel={handleScannerPointerUp}
                    >
                      <polygon
                        points={activeScannerItem.scanner.corners
                          .map((point) => `${point.x},${point.y}`)
                          .join(' ')}
                        fill="rgba(255, 90, 69, 0.16)"
                        stroke="#ff725f"
                        strokeWidth={Math.max(2, Math.min(activeScannerItem.width, activeScannerItem.height) / 120)}
                        vectorEffect="non-scaling-stroke"
                      />
                      {activeScannerItem.scanner.corners.map((point, index) => (
                        <g key={scannerCornerLabels[index]}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={Math.max(10, Math.min(activeScannerItem.width, activeScannerItem.height) / 18)}
                            fill="#ffffff"
                            stroke="#e84c38"
                            strokeWidth="3"
                            className="cursor-grab drop-shadow-sm active:cursor-grabbing"
                            aria-label={scannerCornerLabels[index]}
                            role="button"
                            tabIndex={0}
                            onPointerDown={(event) => {
                              if (isBusy) return
                              event.currentTarget.setPointerCapture(event.pointerId)
                              setDraggingCornerIndex(index)
                            }}
                            onKeyDown={(event) => {
                              if (isBusy) return
                              const step = event.shiftKey ? 10 : 2
                              const delta =
                                event.key === 'ArrowLeft'
                                  ? { x: -step, y: 0 }
                                  : event.key === 'ArrowRight'
                                    ? { x: step, y: 0 }
                                    : event.key === 'ArrowUp'
                                      ? { x: 0, y: -step }
                                      : event.key === 'ArrowDown'
                                        ? { x: 0, y: step }
                                        : null
                              if (!delta) return
                              event.preventDefault()
                              setItems((currentItems) => {
                                const item = currentItems.find((candidate) => candidate.id === activeScannerItem.id)
                                if (!item) return currentItems
                                const currentPoint = item.scanner.corners[index]
                                const corners = item.scanner.corners.map((candidate, candidateIndex) =>
                                  candidateIndex === index
                                    ? clampScannerPoint(
                                        { x: currentPoint.x + delta.x, y: currentPoint.y + delta.y },
                                        item.width,
                                        item.height,
                                      )
                                    : candidate,
                                ) as unknown as ScannerCorners
                                return setScannerCorners(currentItems, item.id, corners)
                              })
                              markScannerCornersAsManual(activeScannerItem.scanner.active)
                            }}
                          />
                          <text
                            x={point.x}
                            y={point.y + 4}
                            textAnchor="middle"
                            className="pointer-events-none fill-slate-900 text-[12px] font-bold"
                          >
                            {index + 1}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-slate-500">
                    <Crosshair className="size-3.5 shrink-0" aria-hidden="true" />
                    Arrastra los cuatro puntos; también puedes enfocarlos y moverlos con las flechas.
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <ScannerPerspectivePreview item={activeScannerItem} />
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5" aria-live="polite">
                    <p className="font-medium text-slate-700">
                      {activeScannerItem.scanner.detected
                        ? `Confianza automática: ${Math.round(activeScannerItem.scanner.confidence * 100)}%`
                        : 'Sin detección automática aplicada'}
                    </p>
                    {activeScannerItem.scanner.detected && activeScannerItem.scanner.confidence < 0.6 && (
                      <p className="mt-1 text-amber-700">Confianza baja: revisa las esquinas antes de exportar.</p>
                    )}
                    {scannerMessage && <p className="mt-1 text-slate-500">{scannerMessage}</p>}
                    {scannerStatus === 'error' && <p className="mt-1 text-red-700">Puedes continuar con el ajuste manual.</p>}
                  </div>
                  {!isScannerQuadrilateralValid(activeScannerItem.scanner.corners) && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      Las esquinas se cruzan o están demasiado juntas. Corrígelas para aplicar la perspectiva.
                    </p>
                  )}
                  {isScanning && scannerStage && (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                      {({
                        'loading-opencv': 'Cargando motor local…',
                        detecting: 'Detectando documento…',
                        'correcting-perspective': 'Corrigiendo perspectiva…',
                        filtering: 'Preparando resultado…',
                      } satisfies Record<ScannerWorkerStage, string>)[scannerStage]}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl bg-white"
                      onClick={resetScanner}
                      disabled={isBusy}
                    >
                      Restablecer esquinas
                    </Button>
                    <Button
                      type="button"
                      variant={activeScannerItem.scanner.active ? 'outline' : 'default'}
                      className="rounded-xl"
                      onClick={toggleScannerPerspective}
                      disabled={isBusy || !isScannerQuadrilateralValid(activeScannerItem.scanner.corners)}
                    >
                      {activeScannerItem.scanner.active ? 'Quitar perspectiva' : 'Aplicar perspectiva'}
                    </Button>
                    {isScanning ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl bg-white"
                        onClick={cancelScannerDetection}
                      >
                        Cancelar detección
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl bg-white"
                        onClick={() => void detectScannerDocument()}
                        disabled={isBusy}
                      >
                        <ScanLine data-icon="inline-start" aria-hidden="true" />
                        Detectar automáticamente
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {items.length > 0 && (
            <section
              aria-labelledby="pdf-options-title"
              data-testid="pdf-options"
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                  <Settings2 className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="pdf-options-title" className="text-sm font-semibold text-slate-950">
                    Configuración del PDF
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Estas opciones se aplican a todas las páginas al descargar el documento.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Tamaño de página
                  <select
                    aria-label="Tamaño de página"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
                    value={pagePreset}
                    onChange={(event) => setPagePreset(event.target.value as PdfPagePreset)}
                    disabled={isBusy}
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Carta / Letter</option>
                    <option value="image">Tamaño de imagen</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Márgenes
                  <select
                    aria-label="Márgenes"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
                    value={String(marginMm)}
                    onChange={(event) => setMarginMm(Number(event.target.value) as PdfMarginMm)}
                    disabled={isBusy}
                  >
                    <option value="0">Sin margen</option>
                    <option value="5">5 mm</option>
                    <option value="10">10 mm</option>
                    <option value="15">15 mm</option>
                    <option value="20">20 mm</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-slate-600">
                  Ajuste de imagen
                  <select
                    aria-label="Ajuste de imagen"
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-3 focus:ring-slate-200"
                    value={fitMode}
                    onChange={(event) => setFitMode(event.target.value as PdfFitMode)}
                    disabled={isBusy}
                  >
                    <option value="contain">Encajar completa</option>
                    <option value="cover">Cubrir página</option>
                    <option value="stretch">Estirar al área</option>
                  </select>
                </label>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {pagePreset === 'image'
                  ? 'El tamaño de cada página se calcula a partir de sus píxeles y respeta los márgenes elegidos.'
                  : 'La orientación se adapta automáticamente a la orientación dominante de cada imagen.'}
              </p>
            </section>
          )}

          {(isExporting || exportState.status === 'success' || exportState.status === 'cancelled' || exportError) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-live="polite">
              {isExporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                    <span>
                      {exportState.status === 'cancelling'
                        ? 'Cancelando exportación…'
                        : exportState.stage === 'saving'
                          ? 'Guardando PDF…'
                          : `Componiendo página ${exportState.currentPage} de ${exportState.totalPages}…`}
                    </span>
                    <span>{Math.round(exportState.progress * 100)}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label="Progreso de exportación"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(exportState.progress * 100)}
                  >
                    <div
                      className="h-full rounded-full bg-[#e84c38] transition-[width] duration-200"
                      style={{ width: `${Math.max(4, exportState.progress * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {exportState.status === 'success' && (
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  PDF generado y descargado correctamente.
                </p>
              )}
              {exportState.status === 'cancelled' && (
                <p className="text-sm font-medium text-slate-600">
                  La exportación se canceló sin descargar un archivo incompleto.
                </p>
              )}
              {exportError && (
                <p className="text-sm font-medium text-red-700">{exportError}</p>
              )}
            </div>
          )}
        </CardContent>

        {items.length > 0 && (
          <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-7">
            {isExporting && (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl bg-white"
                onClick={cancelExport}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              className="rounded-xl bg-slate-950 px-4 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
              disabled={isBusy}
              onClick={() => void exportPdf()}
            >
              {isExporting ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden="true" />
              ) : (
                <FileDown data-icon="inline-start" aria-hidden="true" />
              )}
              {isExporting ? 'Generando PDF…' : 'Generar y descargar PDF'}
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  )
}
