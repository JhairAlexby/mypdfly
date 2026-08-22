import {
  throwIfExportAborted,
} from '@/components/pdf-editor/export-cancellation'
import type { PdfExportProgress } from '../core/pdf-export'
import {
  assertImageExportBudget,
} from '../core/pdf-export'
import type { ImageAsset } from '../core/document'
import { applyImageFilterToPixels } from '../core/image-filters'
import { decodeImageFile } from '../core/image-source'
import { isScannerQuadrilateralValid } from '../core/scanner/geometry'
import { renderPerspectiveCanvas } from '../core/scanner/perspective'
import {
  getCompositionPageSizeMm,
  getPrintablePageRectMm,
  mapNormalizedRectToBounds,
  type CompositionRect,
} from './geometry'
import {
  createImagePdfDocument,
  getPlacementsInPaintOrder,
  type ImageCompositionPage,
  type ImagePdfDocument,
  type ImagePlacement,
} from './model'

export type CompositionFitMode = 'contain' | 'cover' | 'stretch'

export type CompositionCanvasFactory = (
  width: number,
  height: number,
) => HTMLCanvasElement

export type CompositionRenderOptions = {
  readonly canvasFactory?: CompositionCanvasFactory
  readonly fitMode?: CompositionFitMode
  /** Reports normalized progress while the placements of one sheet are rendered. */
  readonly onPageProgress?: (progress: number) => void
  readonly renderScale?: number
  readonly signal?: AbortSignal
}

export type CompositionRenderedPage = {
  readonly canvas: HTMLCanvasElement
  readonly pageHeightPt: number
  readonly pageWidthPt: number
  readonly renderScale: number
}

export type CompositionPdfOptions = CompositionRenderOptions & {
  readonly onProgress?: (progress: PdfExportProgress) => void
}

const POINTS_PER_MM = 72 / 25.4
const PREFERRED_RENDER_SCALE = 2
const MAX_RENDER_PIXELS = 8_000_000
const FILTER_ROWS_PER_CHUNK = 256
const RENDER_PROGRESS_MAX = 0.9
const SAVE_PROGRESS = 0.95

type PreparedCompositionAsset = {
  readonly canvas: HTMLCanvasElement
  readonly close: () => void
  readonly height: number
  readonly width: number
}

const resetCanvas = (canvas: HTMLCanvasElement) => {
  canvas.width = 1
  canvas.height = 1
}

const createDefaultCanvas: CompositionCanvasFactory = (width, height) => {
  if (typeof document === 'undefined') {
    throw new Error('Este entorno no permite crear un lienzo de composición.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const createCanvas = (
  width: number,
  height: number,
  factory: CompositionCanvasFactory,
) => {
  const canvas = factory(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)))
  canvas.width = Math.max(1, Math.ceil(width))
  canvas.height = Math.max(1, Math.ceil(height))
  return canvas
}

const getCanvasContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    resetCanvas(canvas)
    throw new Error('El navegador no pudo crear el lienzo de composición.')
  }
  return context
}

const applyFilterToCanvas = async (
  canvas: HTMLCanvasElement,
  filter: ImageAsset['filter'],
  signal?: AbortSignal,
) => {
  if (filter === 'original') return
  const context = getCanvasContext(canvas)

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

const rotateCanvas = (
  source: HTMLCanvasElement,
  rotation: ImageAsset['rotation'],
  factory: CompositionCanvasFactory,
) => {
  if (rotation === 0) return source
  const swapsDimensions = rotation === 90 || rotation === 270
  const canvas = createCanvas(
    swapsDimensions ? source.height : source.width,
    swapsDimensions ? source.width : source.height,
    factory,
  )
  const context = getCanvasContext(canvas)

  context.save()
  if (rotation === 90) {
    context.translate(canvas.width, 0)
    context.rotate(Math.PI / 2)
  } else if (rotation === 180) {
    context.translate(canvas.width, canvas.height)
    context.rotate(Math.PI)
  } else {
    context.translate(0, canvas.height)
    context.rotate((Math.PI * 3) / 2)
  }
  context.drawImage(source, 0, 0, source.width, source.height)
  context.restore()
  return canvas
}

const prepareCompositionAsset = async (
  asset: ImageAsset,
  options: CompositionRenderOptions,
): Promise<PreparedCompositionAsset> => {
  const signal = options.signal
  const factory = options.canvasFactory ?? createDefaultCanvas
  throwIfExportAborted(signal)
  if (asset.scanner.active && !isScannerQuadrilateralValid(asset.scanner.corners)) {
    throw new Error(
      `Las esquinas del escáner de ${asset.file.name} no forman un cuadrilátero válido.`,
    )
  }

  const image = await decodeImageFile(asset.file, signal)
  let perspective: Awaited<ReturnType<typeof renderPerspectiveCanvas>> | null = null
  let baseCanvas: HTMLCanvasElement | null = null
  let outputCanvas: HTMLCanvasElement | null = null

  try {
    if (asset.scanner.active) {
      perspective = await renderPerspectiveCanvas(
        image.source,
        image.width,
        image.height,
        asset.scanner.corners,
        { signal },
      )
    }
    throwIfExportAborted(signal)

    const source = perspective?.canvas ?? image.source
    const sourceWidth = perspective?.canvas.width ?? image.width
    const sourceHeight = perspective?.canvas.height ?? image.height
    baseCanvas = createCanvas(sourceWidth, sourceHeight, factory)
    const context = getCanvasContext(baseCanvas)
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight)
    await applyFilterToCanvas(baseCanvas, asset.filter, signal)
    outputCanvas = rotateCanvas(baseCanvas, asset.rotation, factory)
    const canvas = outputCanvas

    return {
      canvas,
      close: () => resetCanvas(canvas),
      height: canvas.height,
      width: canvas.width,
    }
  } finally {
    if (perspective) resetCanvas(perspective.canvas)
    if (baseCanvas && baseCanvas !== outputCanvas) resetCanvas(baseCanvas)
    image.close()
  }
}

const getRenderScale = (
  pageWidthPt: number,
  pageHeightPt: number,
  requestedScale?: number,
) => {
  const maximumScale = Math.sqrt(
    MAX_RENDER_PIXELS / (pageWidthPt * pageHeightPt),
  )
  const desiredScale = requestedScale ?? PREFERRED_RENDER_SCALE
  if (!Number.isFinite(desiredScale) || desiredScale <= 0) {
    throw new Error('La escala de composición debe ser mayor que cero.')
  }
  return Math.min(desiredScale, maximumScale)
}

const getFitRect = (
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
  fitMode: CompositionFitMode,
) => {
  if (fitMode === 'stretch') {
    return { height: boxHeight, width: boxWidth }
  }

  const scale =
    fitMode === 'cover'
      ? Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
      : Math.min(boxWidth / imageWidth, boxHeight / imageHeight)
  return {
    height: imageHeight * scale,
    width: imageWidth * scale,
  }
}

const getPagePixelRect = (
  rect: CompositionRect,
  renderScale: number,
): CompositionRect => {
  const scale = POINTS_PER_MM * renderScale
  return {
    height: rect.height * scale,
    width: rect.width * scale,
    x: rect.x * scale,
    y: rect.y * scale,
  }
}

const drawPlacement = (
  context: CanvasRenderingContext2D,
  placement: ImagePlacement,
  prepared: PreparedCompositionAsset,
  pageRectMm: CompositionRect,
  renderScale: number,
  fitMode: CompositionFitMode,
) => {
  const box = getPagePixelRect(
    mapNormalizedRectToBounds(placement, pageRectMm),
    renderScale,
  )
  const swapsDimensions = placement.rotation === 90 || placement.rotation === 270
  const imageWidth = swapsDimensions ? prepared.height : prepared.width
  const imageHeight = swapsDimensions ? prepared.width : prepared.height
  const drawRect = getFitRect(
    imageWidth,
    imageHeight,
    box.width,
    box.height,
    fitMode,
  )

  context.save()
  context.beginPath()
  context.rect(box.x, box.y, box.width, box.height)
  context.clip()
  context.translate(box.x + box.width / 2, box.y + box.height / 2)
  context.rotate((placement.rotation * Math.PI) / 180)
  const drawWidth = swapsDimensions ? drawRect.height : drawRect.width
  const drawHeight = swapsDimensions ? drawRect.width : drawRect.height
  context.drawImage(
    prepared.canvas,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  )
  context.restore()
}

const getAssetById = (assets: readonly ImageAsset[], assetId: string) => {
  const asset = assets.find((candidate) => candidate.id === assetId)
  if (!asset) {
    throw new Error(`La colocación ${assetId} referencia una imagen inexistente.`)
  }
  return asset
}

export const renderCompositionPage = async (
  page: ImageCompositionPage,
  assets: readonly ImageAsset[],
  options: CompositionRenderOptions = {},
): Promise<CompositionRenderedPage> => {
  const signal = options.signal
  const factory = options.canvasFactory ?? createDefaultCanvas
  const fitMode = options.fitMode ?? 'contain'
  if (!['contain', 'cover', 'stretch'].includes(fitMode)) {
    throw new Error('El ajuste de imágenes no es compatible.')
  }

  const pageSizeMm = getCompositionPageSizeMm(page)
  const printablePageRectMm = getPrintablePageRectMm(page)
  const pageWidthPt = pageSizeMm.width * POINTS_PER_MM
  const pageHeightPt = pageSizeMm.height * POINTS_PER_MM
  const renderScale = getRenderScale(
    pageWidthPt,
    pageHeightPt,
    options.renderScale,
  )
  const canvas = createCanvas(
    pageWidthPt * renderScale,
    pageHeightPt * renderScale,
    factory,
  )
  const context = getCanvasContext(canvas)
  const preparedAssets = new Map<string, PreparedCompositionAsset>()
  const remainingReferences = new Map<string, number>()
  const placementsInPaintOrder = getPlacementsInPaintOrder(page.placements)
  const totalPlacements = placementsInPaintOrder.length
  options.onPageProgress?.(totalPlacements ? 0 : 1)
  for (const placement of page.placements) {
    remainingReferences.set(
      placement.assetId,
      (remainingReferences.get(placement.assetId) ?? 0) + 1,
    )
  }

  try {
    throwIfExportAborted(signal)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    for (const [placementIndex, placement] of placementsInPaintOrder.entries()) {
      throwIfExportAborted(signal)
      let prepared = preparedAssets.get(placement.assetId)
      if (!prepared) {
        prepared = await prepareCompositionAsset(
          getAssetById(assets, placement.assetId),
          options,
        )
        preparedAssets.set(placement.assetId, prepared)
      }
      drawPlacement(
        context,
        placement,
        prepared,
        printablePageRectMm,
        renderScale,
        fitMode,
      )
      const referencesLeft = (remainingReferences.get(placement.assetId) ?? 1) - 1
      remainingReferences.set(placement.assetId, referencesLeft)
      if (referencesLeft === 0) {
        prepared.close()
        preparedAssets.delete(placement.assetId)
      }
      options.onPageProgress?.((placementIndex + 1) / totalPlacements)
    }
    throwIfExportAborted(signal)

    return {
      canvas,
      pageHeightPt,
      pageWidthPt,
      renderScale,
    }
  } catch (error) {
    resetCanvas(canvas)
    throw error
  } finally {
    preparedAssets.forEach((prepared) => prepared.close())
  }
}

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('El navegador no puede codificar la hoja compuesta.'))
      return
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo preparar la hoja compuesta.'))
    }, 'image/png')
  })

export const createCompositionPdf = async (
  input: ImagePdfDocument,
  options: CompositionPdfOptions = {},
) => {
  if (!input.pages.length) {
    throw new Error('Agrega al menos una hoja antes de exportar.')
  }
  throwIfExportAborted(options.signal)
  const composition = createImagePdfDocument(input.assets, input.pages)
  assertImageExportBudget(composition.assets)
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()

  for (const [index, pageDefinition] of composition.pages.entries()) {
    throwIfExportAborted(options.signal)
    options.onProgress?.({
      currentPage: index + 1,
      progress: (index / composition.pages.length) * RENDER_PROGRESS_MAX,
      stage: 'rendering',
      totalPages: composition.pages.length,
    })
    const renderedPage = await renderCompositionPage(pageDefinition, composition.assets, {
      canvasFactory: options.canvasFactory,
      fitMode: options.fitMode,
      onPageProgress: (pageProgress) => {
        const normalizedPageProgress = Math.min(1, Math.max(0, pageProgress))
        options.onProgress?.({
          currentPage: index + 1,
          progress:
            ((index + normalizedPageProgress) / composition.pages.length) *
            RENDER_PROGRESS_MAX,
          stage: 'rendering',
          totalPages: composition.pages.length,
        })
      },
      renderScale: options.renderScale,
      signal: options.signal,
    })
    try {
      throwIfExportAborted(options.signal)
      const imageBlob = await canvasToPng(renderedPage.canvas)
      const imageBytes = await imageBlob.arrayBuffer()
      const embeddedImage = await pdf.embedPng(imageBytes)
      const page = pdf.addPage([
        renderedPage.pageWidthPt,
        renderedPage.pageHeightPt,
      ])
      page.drawImage(embeddedImage, {
        height: renderedPage.pageHeightPt,
        width: renderedPage.pageWidthPt,
        x: 0,
        y: 0,
      })
    } finally {
      resetCanvas(renderedPage.canvas)
    }
    options.onProgress?.({
      currentPage: index + 1,
      progress: ((index + 1) / composition.pages.length) * RENDER_PROGRESS_MAX,
      stage: 'rendering',
      totalPages: composition.pages.length,
    })
  }

  throwIfExportAborted(options.signal)
  options.onProgress?.({
    currentPage: composition.pages.length,
    progress: SAVE_PROGRESS,
    stage: 'saving',
    totalPages: composition.pages.length,
  })
  const bytes = await pdf.save({ useObjectStreams: true })
  throwIfExportAborted(options.signal)
  options.onProgress?.({
    currentPage: composition.pages.length,
    progress: 1,
    stage: 'complete',
    totalPages: composition.pages.length,
  })
  return new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' })
}
