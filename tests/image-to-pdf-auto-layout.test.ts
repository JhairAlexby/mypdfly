import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAutoLayoutPages,
  getAutoGridDimensions,
  getImageAspectRatio,
} from '../src/features/image-to-pdf/composer/auto-layout.ts'
import {
  getPrintablePageRectMm,
  isNormalizedPlacementRect,
  mapNormalizedRectToBounds,
} from '../src/features/image-to-pdf/composer/geometry.ts'
import type { ImageAsset } from '../src/features/image-to-pdf/core/document.ts'
import { createImageScannerState } from '../src/features/image-to-pdf/core/scanner/geometry.ts'

const createAsset = (
  id: string,
  width = 120,
  height = 80,
  rotation: ImageAsset['rotation'] = 0,
): ImageAsset => ({
  file: new File([new Uint8Array([1])], `${id}.jpg`, { type: 'image/jpeg' }),
  filter: 'original',
  height,
  id,
  previewUrl: `blob:${id}`,
  rotation,
  scanner: createImageScannerState(width, height),
  width,
})

const rectanglesOverlap = (
  first: { height: number; width: number; x: number; y: number },
  second: { height: number; width: number; x: number; y: number },
) =>
  first.x < second.x + second.width &&
  first.x + first.width > second.x &&
  first.y < second.y + second.height &&
  first.y + first.height > second.y

test('elige una cuadrícula determinista según las proporciones de las imágenes', () => {
  assert.deepEqual(getAutoGridDimensions([1, 1, 1], 190 / 277), {
    columns: 2,
    rows: 2,
  })
  assert.deepEqual(getAutoGridDimensions([1.5, 1.5, 1.5], 190 / 277), {
    columns: 1,
    rows: 3,
  })
  assert.deepEqual(getAutoGridDimensions([1.5, 1.5], 279.4 / 175.9), {
    columns: 2,
    rows: 1,
  })
  assert.throws(
    () => getAutoGridDimensions([], 1),
    /al menos una imagen/,
  )
})

test('calcula la proporción efectiva después de rotar una imagen', () => {
  assert.equal(getImageAspectRatio(createAsset('wide')), 1.5)
  assert.equal(getImageAspectRatio(createAsset('rotated', 120, 80, 90)), 2 / 3)
})

test('distribuye todas las imágenes en una hoja con gaps físicos y sin solapamientos', () => {
  const assets = [
    createAsset('one', 100, 100),
    createAsset('two', 100, 100),
    createAsset('three', 100, 100),
    createAsset('four', 100, 100),
    createAsset('five', 100, 100),
  ]
  const [page] = createAutoLayoutPages(assets, { gapMm: 5 })

  assert.ok(page)
  assert.equal(page.placements.length, assets.length)
  assert.equal(page.id, 'auto-page-1')
  assert.deepEqual(
    page.placements.map(({ assetId }) => assetId),
    assets.map(({ id }) => id),
  )
  assert.ok(page.placements.every(isNormalizedPlacementRect))

  const printable = getPrintablePageRectMm(page)
  const rectangles = page.placements.map((placement) =>
    mapNormalizedRectToBounds(placement, printable),
  )
  for (let firstIndex = 0; firstIndex < rectangles.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < rectangles.length; secondIndex += 1) {
      assert.equal(
        rectanglesOverlap(rectangles[firstIndex]!, rectangles[secondIndex]!),
        false,
      )
    }
  }
  assert.ok(
    rectangles.some(
      (rectangle) => Math.abs(rectangle.x - printable.x) < 1e-9,
    ),
  )
  assert.ok(
    rectangles.every(
      (rectangle) => rectangle.x >= printable.x && rectangle.y >= printable.y,
    ),
  )
})

test('parte la distribución en varias hojas manteniendo el orden y los identificadores', () => {
  const assets = Array.from({ length: 5 }, (_, index) =>
    createAsset(`asset-${index + 1}`),
  )
  const pages = createAutoLayoutPages(assets, {
    gapMm: 0,
    itemsPerPage: 2,
    marginMm: 5,
    orientation: 'landscape',
    pageIdPrefix: 'sheet',
    preset: 'letter',
  })

  assert.deepEqual(pages.map(({ id }) => id), ['sheet-1', 'sheet-2', 'sheet-3'])
  assert.deepEqual(
    pages.map(({ placements }) => placements.length),
    [2, 2, 1],
  )
  assert.deepEqual(
    pages.flatMap(({ placements }) => placements.map(({ assetId }) => assetId)),
    assets.map(({ id }) => id),
  )
  assert.deepEqual(
    pages.flatMap(({ placements }) => placements.map(({ id }) => id)),
    [
      'sheet-1-placement-1',
      'sheet-1-placement-2',
      'sheet-2-placement-1',
      'sheet-2-placement-2',
      'sheet-3-placement-1',
    ],
  )
  assert.ok(pages.every((page) => page.orientation === 'landscape'))
  assert.ok(pages.every((page) => page.preset === 'letter'))
  assert.ok(pages.every((page) => page.marginMm === 5))
})

test('rechaza límites y separaciones que no pueden producir una hoja válida', () => {
  const assets = [createAsset('one'), createAsset('two')]

  assert.throws(
    () => createAutoLayoutPages(assets, { gapMm: -1 }),
    /separación no puede ser negativa/,
  )
  assert.throws(
    () => createAutoLayoutPages(assets, { gapMm: 300 }),
    /separación es demasiado grande/,
  )
  assert.throws(
    () => createAutoLayoutPages(assets, { itemsPerPage: 0 }),
    /entero positivo/,
  )
})
