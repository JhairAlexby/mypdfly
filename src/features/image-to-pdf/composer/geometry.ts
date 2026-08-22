import type {
  ImageCompositionPage,
  NormalizedPlacementRect,
} from './model'

export const MIN_PLACEMENT_SIZE = 0.02

const PAPER_SIZE_MM = {
  a4: { height: 297, width: 210 },
  letter: { height: 279.4, width: 215.9 },
} as const

export type CompositionPoint = {
  readonly x: number
  readonly y: number
}

export type CompositionRect = CompositionPoint & {
  readonly height: number
  readonly width: number
}

export type CompositionSize = {
  readonly height: number
  readonly width: number
}

export type PlacementResizeHandle =
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'

export type PlacementResizeOptions = {
  readonly aspectRatio?: number
  readonly lockAspectRatio?: boolean
  readonly minHeight?: number
  readonly minWidth?: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum)

const assertFiniteNumber = (value: number, label: string) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito.`)
  }
}

const assertPositiveBounds = (bounds: CompositionRect) => {
  assertFiniteNumber(bounds.x, 'La coordenada x del área')
  assertFiniteNumber(bounds.y, 'La coordenada y del área')
  assertFiniteNumber(bounds.width, 'El ancho del área')
  assertFiniteNumber(bounds.height, 'El alto del área')

  if (bounds.width <= 0 || bounds.height <= 0) {
    throw new Error('El área de destino debe tener ancho y alto positivos.')
  }
}

const getMinimumPlacementSize = (options: PlacementResizeOptions) => {
  const minWidth = options.minWidth ?? MIN_PLACEMENT_SIZE
  const minHeight = options.minHeight ?? MIN_PLACEMENT_SIZE

  assertFiniteNumber(minWidth, 'El ancho mínimo')
  assertFiniteNumber(minHeight, 'El alto mínimo')
  if (minWidth <= 0 || minWidth > 1 || minHeight <= 0 || minHeight > 1) {
    throw new Error('El tamaño mínimo debe estar dentro del intervalo (0, 1].')
  }

  return { minHeight, minWidth }
}

export const isNormalizedPlacementRect = (
  rect: NormalizedPlacementRect,
) =>
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  Number.isFinite(rect.width) &&
  Number.isFinite(rect.height) &&
  rect.x >= 0 &&
  rect.y >= 0 &&
  rect.width > 0 &&
  rect.height > 0 &&
  rect.x + rect.width <= 1 &&
  rect.y + rect.height <= 1

export const assertNormalizedPlacementRect = (
  rect: NormalizedPlacementRect,
) => {
  if (!isNormalizedPlacementRect(rect)) {
    throw new Error(
      'La colocación debe tener coordenadas y dimensiones normalizadas dentro de la hoja.',
    )
  }
}

export const constrainPlacementRect = (
  rect: NormalizedPlacementRect,
  options: PlacementResizeOptions = {},
): NormalizedPlacementRect => {
  assertFiniteNumber(rect.x, 'La coordenada x')
  assertFiniteNumber(rect.y, 'La coordenada y')
  assertFiniteNumber(rect.width, 'El ancho')
  assertFiniteNumber(rect.height, 'El alto')
  const { minHeight, minWidth } = getMinimumPlacementSize(options)
  const width = clamp(rect.width, minWidth, 1)
  const height = clamp(rect.height, minHeight, 1)

  return {
    height,
    width,
    x: clamp(rect.x, 0, 1 - width),
    y: clamp(rect.y, 0, 1 - height),
  }
}

export const movePlacementRect = (
  rect: NormalizedPlacementRect,
  delta: CompositionPoint,
): NormalizedPlacementRect => {
  assertNormalizedPlacementRect(rect)
  assertFiniteNumber(delta.x, 'El desplazamiento x')
  assertFiniteNumber(delta.y, 'El desplazamiento y')

  return {
    ...rect,
    x: clamp(rect.x + delta.x, 0, 1 - rect.width),
    y: clamp(rect.y + delta.y, 0, 1 - rect.height),
  }
}

const getResizeAnchor = (
  rect: NormalizedPlacementRect,
  handle: PlacementResizeHandle,
) => {
  const isLeft = handle === 'top-left' || handle === 'bottom-left'
  const isTop = handle === 'top-left' || handle === 'top-right'

  return {
    anchor: {
      x: isLeft ? rect.x + rect.width : rect.x,
      y: isTop ? rect.y + rect.height : rect.y,
    },
    xDirection: isLeft ? -1 : 1,
    yDirection: isTop ? -1 : 1,
  } as const
}

export const resizePlacementFromCorner = (
  rect: NormalizedPlacementRect,
  handle: PlacementResizeHandle,
  pointer: CompositionPoint,
  options: PlacementResizeOptions = {},
): NormalizedPlacementRect => {
  assertNormalizedPlacementRect(rect)
  assertFiniteNumber(pointer.x, 'La coordenada x del puntero')
  assertFiniteNumber(pointer.y, 'La coordenada y del puntero')
  const { minHeight, minWidth } = getMinimumPlacementSize(options)
  const { anchor, xDirection, yDirection } = getResizeAnchor(rect, handle)
  const maximumWidth = xDirection > 0 ? 1 - anchor.x : anchor.x
  const maximumHeight = yDirection > 0 ? 1 - anchor.y : anchor.y
  const desiredWidth = (pointer.x - anchor.x) * xDirection
  const desiredHeight = (pointer.y - anchor.y) * yDirection
  let width: number
  let height: number

  if (options.lockAspectRatio) {
    const aspectRatio = options.aspectRatio ?? rect.width / rect.height
    assertFiniteNumber(aspectRatio, 'La proporción')
    if (aspectRatio <= 0) {
      throw new Error('La proporción debe ser mayor que cero.')
    }

    const desiredHeightOnRatio =
      (desiredWidth * aspectRatio + desiredHeight) /
      (aspectRatio * aspectRatio + 1)
    const maximumHeightOnRatio = Math.min(
      maximumHeight,
      maximumWidth / aspectRatio,
    )
    const requestedMinimumHeight = Math.max(minHeight, minWidth / aspectRatio)
    const minimumHeightOnRatio =
      maximumHeightOnRatio < requestedMinimumHeight
        ? Math.min(maximumHeightOnRatio, Number.EPSILON)
        : requestedMinimumHeight
    height = clamp(
      desiredHeightOnRatio,
      minimumHeightOnRatio,
      maximumHeightOnRatio,
    )
    width = height * aspectRatio
  } else {
    const effectiveMinWidth =
      maximumWidth < minWidth ? Math.min(maximumWidth, Number.EPSILON) : minWidth
    const effectiveMinHeight =
      maximumHeight < minHeight
        ? Math.min(maximumHeight, Number.EPSILON)
        : minHeight
    width = clamp(desiredWidth, effectiveMinWidth, maximumWidth)
    height = clamp(desiredHeight, effectiveMinHeight, maximumHeight)
  }

  return {
    height,
    width,
    x: xDirection > 0 ? anchor.x : anchor.x - width,
    y: yDirection > 0 ? anchor.y : anchor.y - height,
  }
}

export const getCompositionPageSizeMm = (
  page: Pick<ImageCompositionPage, 'orientation' | 'preset'>,
): CompositionSize => {
  const paper = PAPER_SIZE_MM[page.preset]
  if (!paper) throw new Error('El tamaño de hoja no es compatible.')
  if (page.orientation !== 'portrait' && page.orientation !== 'landscape') {
    throw new Error('La orientación de la hoja no es compatible.')
  }
  return page.orientation === 'landscape'
    ? { height: paper.width, width: paper.height }
    : { height: paper.height, width: paper.width }
}

export const getPrintablePageRectMm = (
  page: Pick<
    ImageCompositionPage,
    'marginMm' | 'orientation' | 'preset'
  >,
): CompositionRect => {
  assertFiniteNumber(page.marginMm, 'El margen')
  if (page.marginMm < 0) {
    throw new Error('El margen no puede ser negativo.')
  }

  const pageSize = getCompositionPageSizeMm(page)
  const width = pageSize.width - page.marginMm * 2
  const height = pageSize.height - page.marginMm * 2
  if (width <= 0 || height <= 0) {
    throw new Error('El margen no puede ocupar toda el área de la hoja.')
  }

  return {
    height,
    width,
    x: page.marginMm,
    y: page.marginMm,
  }
}

export const mapNormalizedRectToBounds = (
  rect: NormalizedPlacementRect,
  bounds: CompositionRect,
): CompositionRect => {
  assertNormalizedPlacementRect(rect)
  assertPositiveBounds(bounds)

  return {
    height: rect.height * bounds.height,
    width: rect.width * bounds.width,
    x: bounds.x + rect.x * bounds.width,
    y: bounds.y + rect.y * bounds.height,
  }
}

export const mapBoundsRectToNormalized = (
  rect: CompositionRect,
  bounds: CompositionRect,
): NormalizedPlacementRect => {
  assertPositiveBounds(rect)
  assertPositiveBounds(bounds)
  const normalized = {
    height: rect.height / bounds.height,
    width: rect.width / bounds.width,
    x: (rect.x - bounds.x) / bounds.width,
    y: (rect.y - bounds.y) / bounds.height,
  }
  assertNormalizedPlacementRect(normalized)
  return normalized
}
