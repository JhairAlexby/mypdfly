import assert from 'node:assert/strict'
import test from 'node:test'

import {
  constrainPlacementRect,
  getCompositionPageSizeMm,
  getPrintablePageRectMm,
  isNormalizedPlacementRect,
  mapBoundsRectToNormalized,
  mapNormalizedRectToBounds,
  movePlacementRect,
  resizePlacementFromCorner,
} from '../src/features/image-to-pdf/composer/geometry.ts'
import {
  createImageCompositionPage,
  createImagePdfDocument,
  createImagePlacement,
  getPlacementsInPaintOrder,
} from '../src/features/image-to-pdf/composer/model.ts'
import type { ImageAsset } from '../src/features/image-to-pdf/core/document.ts'
import { createImageScannerState } from '../src/features/image-to-pdf/core/scanner/geometry.ts'

const assertClose = (actual: number, expected: number) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    `Se esperaba ${expected}, pero se obtuvo ${actual}.`,
  )

const createAsset = (id: string): ImageAsset => ({
  file: new File([new Uint8Array([1])], `${id}.jpg`, { type: 'image/jpeg' }),
  filter: 'original',
  height: 800,
  id,
  previewUrl: `blob:${id}`,
  rotation: 0,
  scanner: createImageScannerState(1200, 800),
  width: 1200,
})

const createPlacement = (
  id: string,
  assetId: string,
  layer = 0,
) =>
  createImagePlacement({
    assetId,
    height: 0.3,
    id,
    layer,
    width: 0.4,
    x: 0.1,
    y: 0.1,
  })

test('separa imágenes, hojas y colocaciones sin duplicar los archivos', () => {
  const assets = [createAsset('front'), createAsset('back')]
  const firstPlacement = createPlacement('front-first', 'front')
  const repeatedPlacement = createPlacement('front-second', 'front')
  const pages = [
    createImageCompositionPage({
      id: 'page-one',
      placements: [firstPlacement, createPlacement('back-first', 'back')],
    }),
    createImageCompositionPage({
      id: 'page-two',
      orientation: 'landscape',
      placements: [repeatedPlacement],
      preset: 'letter',
    }),
  ]
  const document = createImagePdfDocument(assets, pages)

  assert.equal(document.assets.length, 2)
  assert.equal(document.pages.length, 2)
  assert.deepEqual(
    document.pages.flatMap((page) => page.placements.map(({ assetId }) => assetId)),
    ['front', 'back', 'front'],
  )
  assert.notEqual(document.assets, assets)
  assert.notEqual(document.pages, pages)
  assert.notEqual(document.pages[0]?.placements, pages[0]?.placements)
})

test('protege las referencias e identificadores del modelo de composición', () => {
  const asset = createAsset('photo')
  const placement = createPlacement('placement', 'photo')
  const page = createImageCompositionPage({ id: 'page', placements: [placement] })

  assert.throws(
    () => createImagePdfDocument([asset, asset], [page]),
    /identificador duplicado photo/,
  )
  assert.throws(
    () =>
      createImagePdfDocument(
        [asset],
        [
          createImageCompositionPage({
            id: 'missing-reference',
            placements: [createPlacement('missing', 'unknown')],
          }),
        ],
      ),
    /referencia una imagen inexistente/,
  )
  assert.throws(
    () =>
      createImagePlacement({
        assetId: 'photo',
        height: 0.4,
        id: 'outside',
        width: 0.4,
        x: 0.8,
        y: 0,
      }),
    /dentro de la hoja/,
  )
})

test('ordena las capas de forma estable sin mutar las colocaciones', () => {
  const placements = [
    createPlacement('middle-first', 'photo', 2),
    createPlacement('back', 'photo', -1),
    createPlacement('middle-second', 'photo', 2),
    createPlacement('front', 'photo', 5),
  ]

  assert.deepEqual(
    getPlacementsInPaintOrder(placements).map(({ id }) => id),
    ['back', 'middle-first', 'middle-second', 'front'],
  )
  assert.deepEqual(
    placements.map(({ id }) => id),
    ['middle-first', 'back', 'middle-second', 'front'],
  )
})

test('calcula A4 y Carta en ambas orientaciones con su área imprimible', () => {
  const a4Portrait = createImageCompositionPage({ id: 'a4' })
  const letterLandscape = createImageCompositionPage({
    id: 'letter',
    marginMm: 20,
    orientation: 'landscape',
    preset: 'letter',
  })

  assert.deepEqual(getCompositionPageSizeMm(a4Portrait), {
    height: 297,
    width: 210,
  })
  assert.deepEqual(getPrintablePageRectMm(a4Portrait), {
    height: 277,
    width: 190,
    x: 10,
    y: 10,
  })
  assert.deepEqual(getCompositionPageSizeMm(letterLandscape), {
    height: 215.9,
    width: 279.4,
  })
  const printableLetter = getPrintablePageRectMm(letterLandscape)
  assertClose(printableLetter.height, 175.9)
  assertClose(printableLetter.width, 239.4)
  assert.equal(printableLetter.x, 20)
  assert.equal(printableLetter.y, 20)
})

test('convierte coordenadas normalizadas al área imprimible y permite volver', () => {
  const printable = getPrintablePageRectMm(
    createImageCompositionPage({ id: 'page', marginMm: 10 }),
  )
  const normalized = { height: 0.25, width: 0.5, x: 0.1, y: 0.2 }
  const absolute = mapNormalizedRectToBounds(normalized, printable)

  assert.deepEqual(absolute, {
    height: 69.25,
    width: 95,
    x: 29,
    y: 65.4,
  })
  assert.deepEqual(mapBoundsRectToNormalized(absolute, printable), normalized)
})

test('repara una colocación finita respetando tamaño mínimo y límites', () => {
  const constrained = constrainPlacementRect({
    height: -1,
    width: 2,
    x: 0.9,
    y: -0.5,
  })

  assert.deepEqual(constrained, {
    height: 0.02,
    width: 1,
    x: 0,
    y: 0,
  })
  assert.equal(isNormalizedPlacementRect(constrained), true)
  assert.throws(
    () =>
      constrainPlacementRect({
        height: 0.2,
        width: Number.NaN,
        x: 0,
        y: 0,
      }),
    /número finito/,
  )
})

test('mueve una colocación sin cambiar su tamaño ni salir de la hoja', () => {
  const rect = { height: 0.3, width: 0.4, x: 0.2, y: 0.25 }

  assert.deepEqual(movePlacementRect(rect, { x: 0.7, y: -0.6 }), {
    height: 0.3,
    width: 0.4,
    x: 0.6,
    y: 0,
  })
  assert.deepEqual(rect, { height: 0.3, width: 0.4, x: 0.2, y: 0.25 })
})

test('redimensiona desde una esquina y mantiene fija la esquina opuesta', () => {
  const rect = { height: 0.3, width: 0.4, x: 0.2, y: 0.25 }
  const resized = resizePlacementFromCorner(
    rect,
    'top-left',
    { x: -0.5, y: 0.1 },
    { minHeight: 0.05, minWidth: 0.05 },
  )

  assertClose(resized.height, 0.45)
  assertClose(resized.width, 0.6)
  assertClose(resized.x, 0)
  assertClose(resized.y, 0.1)
  assertClose(resized.x + resized.width, rect.x + rect.width)
  assertClose(resized.y + resized.height, rect.y + rect.height)
  assert.equal(isNormalizedPlacementRect(resized), true)
})

test('conserva la proporción y aplica el tamaño mínimo al redimensionar', () => {
  const rect = { height: 0.2, width: 0.4, x: 0.2, y: 0.2 }
  const expanded = resizePlacementFromCorner(
    rect,
    'bottom-right',
    { x: 1.4, y: 1.4 },
    { lockAspectRatio: true },
  )
  const reduced = resizePlacementFromCorner(
    rect,
    'bottom-right',
    { x: 0.19, y: 0.19 },
    { lockAspectRatio: true, minHeight: 0.05, minWidth: 0.05 },
  )

  assert.deepEqual(expanded, {
    height: 0.4,
    width: 0.8,
    x: 0.2,
    y: 0.2,
  })
  assert.deepEqual(reduced, {
    height: 0.05,
    width: 0.1,
    x: 0.2,
    y: 0.2,
  })
  assert.equal(expanded.width / expanded.height, 2)
  assert.equal(reduced.width / reduced.height, 2)
})

test('permite reducir una colocación cuando el mínimo solicitado no cabe junto al borde', () => {
  const rect = { height: 0.2, width: 0.05, x: 0.95, y: 0.2 }
  const resized = resizePlacementFromCorner(
    rect,
    'top-right',
    { x: 0.96, y: 0.25 },
    { minHeight: 0.1, minWidth: 0.1 },
  )

  assert.ok(resized.width > 0 && resized.width < rect.width)
  assert.ok(resized.height > 0 && resized.height < rect.height)
  assertClose(resized.x, rect.x)
  assertClose(resized.y + resized.height, rect.y + rect.height)
  assert.equal(isNormalizedPlacementRect(resized), true)
})

test('permite reducir con proporción bloqueada aunque el mínimo proporcional no quepa', () => {
  const rect = { height: 0.1, width: 0.05, x: 0.95, y: 0.8 }
  const resized = resizePlacementFromCorner(
    rect,
    'bottom-right',
    { x: 0.96, y: 0.85 },
    { lockAspectRatio: true, minHeight: 0.2, minWidth: 0.2 },
  )

  assert.ok(resized.width > 0 && resized.width < rect.width)
  assert.ok(resized.height > 0 && resized.height < rect.height)
  assertClose(resized.width / resized.height, rect.width / rect.height)
  assertClose(resized.x, rect.x)
  assertClose(resized.y, rect.y)
  assert.equal(isNormalizedPlacementRect(resized), true)
})
