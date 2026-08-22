import {
  ExportCancelledError,
  throwIfExportAborted,
} from '@/components/pdf-editor/export-cancellation'
import {
  getImagePixelCount,
  MAX_IMAGE_PIXELS,
  MAX_TOTAL_IMAGE_PIXELS,
  type ImageDocumentItem,
} from './document'
import { applyImageFilterToPixels } from './image-filters'
import { decodeImageFile } from './image-source'
import { getPerspectiveOutputSize, isScannerQuadrilateralValid } from './scanner/geometry'
import { renderPerspectiveCanvas } from './scanner/perspective'

export type PdfPagePreset = 'a4' | 'letter' | 'image'
export type PdfFitMode = 'contain' | 'cover' | 'stretch'
export type PdfMarginMm = 0 | 5 | 10 | 15 | 20

export type PdfExportOptions = {
  readonly pagePreset: PdfPagePreset
  readonly marginMm: PdfMarginMm
  readonly fitMode: PdfFitMode
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: PdfExportProgress) => void
}

export type PdfExportProgress = {
  readonly currentPage: number
  readonly totalPages: number
  readonly progress: number
  readonly stage: 'rendering' | 'saving' | 'complete'
}

export type PdfPageLayout = {
  readonly pageHeightPt: number
  readonly pageWidthPt: number
  readonly marginPt: number
  readonly imageHeightPt: number
  readonly imageWidthPt: number
  readonly contentHeightPt: number
  readonly contentWidthPt: number
}

export type PdfImageDrawRect = {
  readonly heightPt: number
  readonly widthPt: number
  readonly xPt: number
  readonly yPt: number
}

const POINTS_PER_MM = 72 / 25.4
const POINTS_PER_CSS_PIXEL = 72 / 96
const MAX_RENDER_PIXELS = 8_000_000
const PREFERRED_RENDER_SCALE = 2
const RENDER_PROGRESS_MAX = 0.9
const SAVE_PROGRESS = 0.95
const FILTER_ROWS_PER_CHUNK = 256

const PAPER_SIZES: Record<Exclude<PdfPagePreset, 'image'>, { widthPt: number; heightPt: number }> = {
  a4: { heightPt: 841.89, widthPt: 595.28 },
  letter: { heightPt: 792, widthPt: 612 },
}

const getOrientedImageDimensions = (item: ImageDocumentItem) =>
  (() => {
    const scannerDimensions = item.scanner.active
      ? getPerspectiveOutputSize(item.scanner.corners)
      : { height: item.height, width: item.width }
    return item.rotation === 90 || item.rotation === 270
      ? { height: scannerDimensions.width, width: scannerDimensions.height }
      : scannerDimensions
  })()

export const getPdfPageLayout = (
  item: ImageDocumentItem,
  pagePreset: PdfPagePreset,
  marginMm: PdfMarginMm,
): PdfPageLayout => {
  const imageDimensions = getOrientedImageDimensions(item)
  const marginPt = marginMm * POINTS_PER_MM
  const imageWidthPt = imageDimensions.width * POINTS_PER_CSS_PIXEL
  const imageHeightPt = imageDimensions.height * POINTS_PER_CSS_PIXEL

  if (pagePreset === 'image') {
    return {
      contentHeightPt: imageHeightPt,
      contentWidthPt: imageWidthPt,
      imageHeightPt,
      imageWidthPt,
      marginPt,
      pageHeightPt: imageHeightPt + marginPt * 2,
      pageWidthPt: imageWidthPt + marginPt * 2,
    }
  }

  const paper = PAPER_SIZES[pagePreset]
  const isLandscape = imageDimensions.width > imageDimensions.height
  const pageWidthPt = isLandscape ? paper.heightPt : paper.widthPt
  const pageHeightPt = isLandscape ? paper.widthPt : paper.heightPt

  return {
    contentHeightPt: Math.max(1, pageHeightPt - marginPt * 2),
    contentWidthPt: Math.max(1, pageWidthPt - marginPt * 2),
    imageHeightPt,
    imageWidthPt,
    marginPt,
    pageHeightPt,
    pageWidthPt,
  }
}

export const getPdfImageDrawRect = (
  layout: PdfPageLayout,
  fitMode: PdfFitMode,
): PdfImageDrawRect => {
  const scale =
    fitMode === 'stretch'
      ? { x: layout.contentWidthPt / layout.imageWidthPt, y: layout.contentHeightPt / layout.imageHeightPt }
      : fitMode === 'cover'
        ? Math.max(
            layout.contentWidthPt / layout.imageWidthPt,
            layout.contentHeightPt / layout.imageHeightPt,
          )
        : Math.min(
            layout.contentWidthPt / layout.imageWidthPt,
            layout.contentHeightPt / layout.imageHeightPt,
          )

  const widthPt =
    typeof scale === 'number'
      ? layout.imageWidthPt * scale
      : layout.imageWidthPt * scale.x
  const heightPt =
    typeof scale === 'number'
      ? layout.imageHeightPt * scale
      : layout.imageHeightPt * scale.y

  return {
    heightPt,
    widthPt,
    xPt: layout.marginPt + (layout.contentWidthPt - widthPt) / 2,
    yPt: layout.marginPt + (layout.contentHeightPt - heightPt) / 2,
  }
}

export const assertImageExportBudget = (
  items: readonly ImageDocumentItem[],
) => {
  let totalPixels = 0

  for (const item of items) {
    const pixels = getImagePixelCount(item.width, item.height)
    if (pixels > MAX_IMAGE_PIXELS) {
      throw new Error(
        `La imagen ${item.file.name} supera el límite de ${Math.round(MAX_IMAGE_PIXELS / 1_000_000)} MP.`,
      )
    }
    totalPixels += pixels
  }

  if (totalPixels > MAX_TOTAL_IMAGE_PIXELS) {
    throw new Error(
      `El documento supera el límite de ${Math.round(MAX_TOTAL_IMAGE_PIXELS / 1_000_000)} MP.`,
    )
  }
}

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('No se pudo preparar una página del PDF.'))
      }
    }, 'image/png')
  })

const applyFilterToCanvas = async (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  filter: ImageDocumentItem['filter'],
  signal?: AbortSignal,
) => {
  for (let y = 0; y < canvas.height; y += FILTER_ROWS_PER_CHUNK) {
    throwIfExportAborted(signal)
    const height = Math.min(FILTER_ROWS_PER_CHUNK, canvas.height - y)
    const imageData = context.getImageData(0, y, canvas.width, height)
    applyImageFilterToPixels(imageData.data, filter)
    context.putImageData(imageData, 0, y)

    if (y + height < canvas.height) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  throwIfExportAborted(signal)
}

const renderImagePage = async (
  item: ImageDocumentItem,
  layout: PdfPageLayout,
  fitMode: PdfFitMode,
  signal?: AbortSignal,
) => {
  throwIfExportAborted(signal)
  if (item.scanner.active && !isScannerQuadrilateralValid(item.scanner.corners)) {
    throw new Error('Las esquinas del escáner no forman un cuadrilátero válido.')
  }
  const image = await decodeImageFile(item.file, signal)
  let perspective: Awaited<ReturnType<typeof renderPerspectiveCanvas>> | null = null
  let canvas: HTMLCanvasElement | null = null

  try {
    if (item.scanner.active) {
      perspective = await renderPerspectiveCanvas(
        image.source,
        image.width,
        image.height,
        item.scanner.corners,
        { signal },
      )
    }
    throwIfExportAborted(signal)
    const drawRect = getPdfImageDrawRect(layout, fitMode)
    const renderScale = Math.min(
      PREFERRED_RENDER_SCALE,
      Math.sqrt(
        MAX_RENDER_PIXELS / (layout.pageWidthPt * layout.pageHeightPt),
      ),
    )
    canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(layout.pageWidthPt * renderScale))
    canvas.height = Math.max(1, Math.round(layout.pageHeightPt * renderScale))
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('El navegador no pudo crear el lienzo de exportación.')
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.save()
    context.translate(
      (drawRect.xPt + drawRect.widthPt / 2) * renderScale,
      (drawRect.yPt + drawRect.heightPt / 2) * renderScale,
    )
    context.rotate((item.rotation * Math.PI) / 180)

    const rotationSwapsDimensions = item.rotation === 90 || item.rotation === 270
    const drawWidth =
      (rotationSwapsDimensions ? drawRect.heightPt : drawRect.widthPt) * renderScale
    const drawHeight =
      (rotationSwapsDimensions ? drawRect.widthPt : drawRect.heightPt) * renderScale
    context.drawImage(
      perspective?.canvas ?? image.source,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight,
    )
    context.restore()
    throwIfExportAborted(signal)
    if (item.filter !== 'original') {
      await applyFilterToCanvas(context, canvas, item.filter, signal)
    }
    return await canvasToPng(canvas)
  } finally {
    if (perspective) {
      perspective.canvas.width = 1
      perspective.canvas.height = 1
    }
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
    image.close()
  }
}

export async function createImagesPdf(
  items: readonly ImageDocumentItem[],
  options: PdfExportOptions,
) {
  if (!items.length) throw new Error('Agrega al menos una imagen antes de exportar.')
  throwIfExportAborted(options.signal)
  assertImageExportBudget(items)
  const { PDFDocument } = await import('pdf-lib')
  const document = await PDFDocument.create()

  for (const [index, item] of items.entries()) {
    throwIfExportAborted(options.signal)
    const layout = getPdfPageLayout(item, options.pagePreset, options.marginMm)
    options.onProgress?.({
      currentPage: index + 1,
      progress: (index / items.length) * RENDER_PROGRESS_MAX,
      stage: 'rendering',
      totalPages: items.length,
    })
    const imageBlob = await renderImagePage(
      item,
      layout,
      options.fitMode,
      options.signal,
    )
    throwIfExportAborted(options.signal)
    const imageBytes = await imageBlob.arrayBuffer()
    const embeddedImage = await document.embedPng(imageBytes)
    const page = document.addPage([layout.pageWidthPt, layout.pageHeightPt])
    page.drawImage(embeddedImage, {
      height: layout.pageHeightPt,
      width: layout.pageWidthPt,
      x: 0,
      y: 0,
    })
    options.onProgress?.({
      currentPage: index + 1,
      progress: ((index + 1) / items.length) * RENDER_PROGRESS_MAX,
      stage: 'rendering',
      totalPages: items.length,
    })
  }

  throwIfExportAborted(options.signal)
  options.onProgress?.({
    currentPage: items.length,
    progress: SAVE_PROGRESS,
    stage: 'saving',
    totalPages: items.length,
  })
  const bytes = await document.save({ useObjectStreams: true })
  throwIfExportAborted(options.signal)
  options.onProgress?.({
    currentPage: items.length,
    progress: 1,
    stage: 'complete',
    totalPages: items.length,
  })
  return new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' })
}

export const isPdfExportCancelled = (error: unknown) =>
  error instanceof ExportCancelledError
