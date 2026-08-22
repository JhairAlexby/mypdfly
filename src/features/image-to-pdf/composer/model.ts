import type { ImageAsset } from '../core/document'
import {
  assertNormalizedPlacementRect,
  getPrintablePageRectMm,
} from './geometry'

export const COMPOSITION_PAGE_PRESETS = ['a4', 'letter'] as const
export const COMPOSITION_PAGE_ORIENTATIONS = [
  'portrait',
  'landscape',
] as const
export const COMPOSITION_PAGE_MARGIN_OPTIONS_MM = [0, 5, 10, 15, 20] as const
export const PLACEMENT_ROTATIONS = [0, 90, 180, 270] as const

export type CompositionPagePreset =
  (typeof COMPOSITION_PAGE_PRESETS)[number]
export type CompositionPageOrientation =
  (typeof COMPOSITION_PAGE_ORIENTATIONS)[number]
export type CompositionPageMarginMm =
  (typeof COMPOSITION_PAGE_MARGIN_OPTIONS_MM)[number]
export type PlacementRotation = (typeof PLACEMENT_ROTATIONS)[number]

/**
 * Coordinates use a top-left origin and are relative to the printable area.
 * A value of 1 represents the complete printable width or height.
 */
export type NormalizedPlacementRect = {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export type ImagePlacement = NormalizedPlacementRect & {
  readonly assetId: string
  readonly id: string
  readonly layer: number
  readonly rotation: PlacementRotation
}

export type ImageCompositionPage = {
  readonly id: string
  readonly marginMm: CompositionPageMarginMm
  readonly orientation: CompositionPageOrientation
  readonly placements: readonly ImagePlacement[]
  readonly preset: CompositionPagePreset
}

export type ImagePdfDocument = {
  readonly assets: readonly ImageAsset[]
  readonly pages: readonly ImageCompositionPage[]
}

export type CreateImagePlacementInput = NormalizedPlacementRect & {
  readonly assetId: string
  readonly id: string
  readonly layer?: number
  readonly rotation?: PlacementRotation
}

export type CreateImageCompositionPageInput = {
  readonly id: string
  readonly marginMm?: CompositionPageMarginMm
  readonly orientation?: CompositionPageOrientation
  readonly placements?: readonly ImagePlacement[]
  readonly preset?: CompositionPagePreset
}

const assertIdentifier = (id: string, label: string) => {
  if (!id.trim()) throw new Error(`${label} necesita un identificador.`)
}

const assertUniqueIds = (
  values: readonly { readonly id: string }[],
  label: string,
) => {
  const ids = new Set<string>()
  for (const value of values) {
    if (ids.has(value.id)) {
      throw new Error(`${label} contiene el identificador duplicado ${value.id}.`)
    }
    ids.add(value.id)
  }
}

export const createImagePlacement = (
  input: CreateImagePlacementInput,
): ImagePlacement => {
  assertIdentifier(input.id, 'La colocación')
  assertIdentifier(input.assetId, 'La referencia de imagen')
  assertNormalizedPlacementRect(input)
  const layer = input.layer ?? 0
  const rotation = input.rotation ?? 0

  if (!Number.isSafeInteger(layer)) {
    throw new Error('La capa de la colocación debe ser un entero seguro.')
  }
  if (!PLACEMENT_ROTATIONS.includes(rotation)) {
    throw new Error('La rotación de la colocación no es compatible.')
  }

  return {
    assetId: input.assetId,
    height: input.height,
    id: input.id,
    layer,
    rotation,
    width: input.width,
    x: input.x,
    y: input.y,
  }
}

export const createImageCompositionPage = (
  input: CreateImageCompositionPageInput,
): ImageCompositionPage => {
  assertIdentifier(input.id, 'La hoja')
  const page: ImageCompositionPage = {
    id: input.id,
    marginMm: input.marginMm ?? 10,
    orientation: input.orientation ?? 'portrait',
    placements: [...(input.placements ?? [])],
    preset: input.preset ?? 'a4',
  }
  if (!COMPOSITION_PAGE_PRESETS.includes(page.preset)) {
    throw new Error('El tamaño de hoja no es compatible.')
  }
  if (!COMPOSITION_PAGE_ORIENTATIONS.includes(page.orientation)) {
    throw new Error('La orientación de la hoja no es compatible.')
  }
  if (!COMPOSITION_PAGE_MARGIN_OPTIONS_MM.includes(page.marginMm)) {
    throw new Error('El margen de la hoja no es compatible.')
  }
  assertUniqueIds(page.placements, `La hoja ${page.id}`)
  getPrintablePageRectMm(page)
  return page
}

export const createImagePdfDocument = (
  assets: readonly ImageAsset[],
  pages: readonly ImageCompositionPage[],
): ImagePdfDocument => {
  for (const asset of assets) assertIdentifier(asset.id, 'La imagen')
  assertUniqueIds(assets, 'El catálogo de imágenes')
  const validatedPages = pages.map((page) =>
    createImageCompositionPage({
      ...page,
      placements: page.placements.map((placement) =>
        createImagePlacement(placement),
      ),
    }),
  )
  assertUniqueIds(validatedPages, 'El documento')
  const assetIds = new Set(assets.map((asset) => asset.id))
  const placements = validatedPages.flatMap((page) => page.placements)
  assertUniqueIds(placements, 'El documento')

  for (const placement of placements) {
    if (!assetIds.has(placement.assetId)) {
      throw new Error(
        `La colocación ${placement.id} referencia una imagen inexistente.`,
      )
    }
  }

  return {
    assets: [...assets],
    pages: validatedPages,
  }
}

export const getPlacementsInPaintOrder = (
  placements: readonly ImagePlacement[],
) =>
  placements
    .map((placement, index) => ({ index, placement }))
    .sort(
      (first, second) =>
        first.placement.layer - second.placement.layer ||
        first.index - second.index,
    )
    .map(({ placement }) => placement)
