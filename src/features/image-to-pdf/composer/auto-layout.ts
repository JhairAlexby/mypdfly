import type { ImageAsset } from '../core/document'
import {
  getPerspectiveOutputSize,
  isScannerQuadrilateralValid,
} from '../core/scanner/geometry'
import {
  getPrintablePageRectMm,
} from './geometry'
import {
  createImageCompositionPage,
  createImagePdfDocument,
  createImagePlacement,
  type CompositionPageMarginMm,
  type CompositionPageOrientation,
  type CompositionPagePreset,
  type ImageCompositionPage,
} from './model'

export const DEFAULT_AUTO_LAYOUT_GAP_MM = 5

export type AutoGridDimensions = {
  readonly columns: number
  readonly rows: number
}

export type AutoLayoutOptions = {
  /** All images share one sheet unless a positive limit is provided. */
  readonly itemsPerPage?: number | 'all'
  readonly gapMm?: number
  readonly marginMm?: CompositionPageMarginMm
  readonly orientation?: CompositionPageOrientation
  readonly pageIdPrefix?: string
  readonly preset?: CompositionPagePreset
}

const SCORE_EPSILON = 1e-12

const assertPositiveFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`)
  }
}

const assertNonNegativeFinite = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} no puede ser negativa.`)
  }
}

const getFitUtilization = (imageAspectRatio: number, cellAspectRatio: number) =>
  Math.min(imageAspectRatio / cellAspectRatio, cellAspectRatio / imageAspectRatio)

/**
 * Chooses a deterministic grid by maximizing the visible image area inside
 * equally sized cells. Empty cells are penalized through the denominator.
 */
export const getAutoGridDimensions = (
  imageAspectRatios: readonly number[],
  pageAspectRatio: number,
): AutoGridDimensions => {
  if (!imageAspectRatios.length) {
    throw new Error('Se necesita al menos una imagen para calcular la cuadrícula.')
  }
  assertPositiveFinite(pageAspectRatio, 'La proporción de la hoja')
  for (const aspectRatio of imageAspectRatios) {
    assertPositiveFinite(aspectRatio, 'La proporción de una imagen')
  }

  let best: {
    columns: number
    occupancy: number
    rows: number
    utilization: number
  } | null = null

  for (let columns = 1; columns <= imageAspectRatios.length; columns += 1) {
    const rows = Math.ceil(imageAspectRatios.length / columns)
    const cellAspectRatio = (pageAspectRatio * rows) / columns
    const utilization =
      imageAspectRatios.reduce(
        (total, imageAspectRatio) =>
          total + getFitUtilization(imageAspectRatio, cellAspectRatio),
        0,
      ) / (columns * rows)
    const occupancy = imageAspectRatios.length / (columns * rows)

    if (
      !best ||
      utilization > best.utilization + SCORE_EPSILON ||
      (Math.abs(utilization - best.utilization) <= SCORE_EPSILON &&
        occupancy > best.occupancy + SCORE_EPSILON) ||
      (Math.abs(utilization - best.utilization) <= SCORE_EPSILON &&
        Math.abs(occupancy - best.occupancy) <= SCORE_EPSILON &&
        columns < best.columns)
    ) {
      best = { columns, occupancy, rows, utilization }
    }
  }

  return {
    columns: best!.columns,
    rows: best!.rows,
  }
}

export const getImageAspectRatio = (asset: ImageAsset) => {
  if (asset.width <= 0 || asset.height <= 0) {
    throw new Error(`La imagen ${asset.id} no tiene dimensiones válidas.`)
  }

  let width = asset.width
  let height = asset.height
  if (asset.scanner.active) {
    if (!isScannerQuadrilateralValid(asset.scanner.corners)) {
      throw new Error(
        `Las esquinas del escáner de ${asset.file.name} no forman un cuadrilátero válido.`,
      )
    }
    const perspectiveSize = getPerspectiveOutputSize(asset.scanner.corners)
    width = perspectiveSize.width
    height = perspectiveSize.height
  }
  if (asset.rotation === 90 || asset.rotation === 270) {
    ;[width, height] = [height, width]
  }

  return width / height
}

const getItemsPerPage = (
  assetsLength: number,
  itemsPerPage: AutoLayoutOptions['itemsPerPage'],
) => {
  if (itemsPerPage === undefined || itemsPerPage === 'all') return assetsLength
  if (!Number.isSafeInteger(itemsPerPage) || itemsPerPage <= 0) {
    throw new Error('El límite de imágenes por hoja debe ser un entero positivo.')
  }
  return Math.min(itemsPerPage, assetsLength)
}

const getNormalizedCellOffset = (
  index: number,
  cellSize: number,
  gap: number,
  totalSize: number,
  normalizedCellSize: number,
) =>
  Math.min(
    1 - normalizedCellSize,
    Math.max(0, (index * (cellSize + gap)) / totalSize),
  )

const createAutoLayoutPage = (
  assets: readonly ImageAsset[],
  pageIndex: number,
  options: Required<
    Pick<
      AutoLayoutOptions,
      'gapMm' | 'marginMm' | 'orientation' | 'pageIdPrefix' | 'preset'
    >
  >,
) => {
  const pageId = `${options.pageIdPrefix}-${pageIndex + 1}`
  const pageSettings = {
    id: pageId,
    marginMm: options.marginMm,
    orientation: options.orientation,
    preset: options.preset,
  } as const
  const printable = getPrintablePageRectMm(pageSettings)
  const grid = getAutoGridDimensions(
    assets.map(getImageAspectRatio),
    printable.width / printable.height,
  )
  const availableWidth = printable.width - options.gapMm * (grid.columns - 1)
  const availableHeight = printable.height - options.gapMm * (grid.rows - 1)
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('La separación es demasiado grande para la cuadrícula.')
  }
  const cellWidth = availableWidth / grid.columns
  const cellHeight = availableHeight / grid.rows
  const normalizedCellWidth = cellWidth / printable.width
  const normalizedCellHeight = cellHeight / printable.height

  const placements = assets.map((asset, index) => {
    const column = index % grid.columns
    const row = Math.floor(index / grid.columns)
    return createImagePlacement({
      assetId: asset.id,
      height: normalizedCellHeight,
      id: `${pageId}-placement-${index + 1}`,
      layer: index,
      rotation: 0,
      width: normalizedCellWidth,
      x: getNormalizedCellOffset(
        column,
        cellWidth,
        options.gapMm,
        printable.width,
        normalizedCellWidth,
      ),
      y: getNormalizedCellOffset(
        row,
        cellHeight,
        options.gapMm,
        printable.height,
        normalizedCellHeight,
      ),
    })
  })

  return createImageCompositionPage({
    ...pageSettings,
    placements,
  })
}

export const createAutoLayoutPages = (
  assets: readonly ImageAsset[],
  options: AutoLayoutOptions = {},
): readonly ImageCompositionPage[] => {
  if (!assets.length) return []
  const gapMm = options.gapMm ?? DEFAULT_AUTO_LAYOUT_GAP_MM
  const marginMm = options.marginMm ?? 10
  const orientation = options.orientation ?? 'portrait'
  const pageIdPrefix = options.pageIdPrefix ?? 'auto-page'
  const preset = options.preset ?? 'a4'
  assertNonNegativeFinite(gapMm, 'La separación')
  if (!pageIdPrefix.trim()) throw new Error('El prefijo de hoja no puede estar vacío.')

  const itemsPerPage = getItemsPerPage(assets.length, options.itemsPerPage)
  const pages: ImageCompositionPage[] = []
  for (let start = 0; start < assets.length; start += itemsPerPage) {
    pages.push(
      createAutoLayoutPage(
        assets.slice(start, start + itemsPerPage),
        pages.length,
        { gapMm, marginMm, orientation, pageIdPrefix, preset },
      ),
    )
  }

  return createImagePdfDocument(assets, pages).pages
}
