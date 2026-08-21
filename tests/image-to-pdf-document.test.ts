import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  applyImageFilterToAll,
  moveImage,
  removeImage,
  rotateImage,
  setImageFilter,
  validateImageFile,
  type ImageDocumentItem,
} from '../src/features/image-to-pdf/core/document.ts'
import {
  createImagesPdf,
  getPdfImageDrawRect,
  getPdfPageLayout,
  isPdfExportCancelled,
} from '../src/features/image-to-pdf/core/pdf-export.ts'
import {
  getImageFilterCss,
  IMAGE_FILTERS,
} from '../src/features/image-to-pdf/core/image-filters.ts'

const createImageFile = (
  name: string,
  type = 'image/jpeg',
  size = 1024,
  lastModified = 1,
) =>
  new File([new Uint8Array(size)], name, {
    lastModified,
    type,
  })

const createItem = (id: string): ImageDocumentItem => ({
  file: createImageFile(`${id}.jpg`),
  filter: 'original',
  height: 100,
  id,
  previewUrl: `blob:${id}`,
  rotation: 0,
  width: 100,
})

test('valida formatos de imagen compatibles y permite MIME ausente con extensión válida', () => {
  assert.deepEqual(
    validateImageFile(createImageFile('foto.JPG', '')),
    { mimeType: 'image/jpeg', valid: true },
  )
  assert.deepEqual(
    validateImageFile(createImageFile('documento.png', 'image/png')),
    { mimeType: 'image/png', valid: true },
  )
})

test('rechaza archivos vacíos, formatos no compatibles y conflictos de tipo', () => {
  assert.equal(
    validateImageFile(createImageFile('vacio.png', 'image/png', 0)).code,
    'empty-file',
  )
  assert.equal(
    validateImageFile(createImageFile('archivo.gif', 'image/gif')).code,
    'unsupported-format',
  )
  assert.equal(
    validateImageFile(createImageFile('foto.png', 'image/jpeg')).code,
    'mime-extension-mismatch',
  )
})

test('aplica límites por imagen, por documento, por cantidad y evita duplicados', () => {
  assert.equal(
    validateImageFile(
      createImageFile('grande.jpg', 'image/jpeg', MAX_IMAGE_SIZE_BYTES + 1),
    ).code,
    'file-too-large',
  )
  assert.equal(
    validateImageFile(createImageFile('ultima.jpg'), {
      existingCount: MAX_IMAGE_COUNT,
    }).code,
    'too-many-files',
  )
  assert.equal(
    validateImageFile(createImageFile('limite.jpg', 'image/jpeg', 2), {
      existingTotalBytes: MAX_TOTAL_IMAGE_SIZE_BYTES - 1,
    }).code,
    'total-size-too-large',
  )

  const duplicate = createImageFile('misma.jpg', 'image/jpeg', 123, 99)
  assert.equal(
    validateImageFile(duplicate, { existingFiles: [duplicate] }).code,
    'duplicate-file',
  )
})

test('reordena, elimina y rota páginas sin mutar la colección original', () => {
  const items = [createItem('one'), createItem('two'), createItem('three')]

  assert.deepEqual(
    moveImage(items, 2, 0).map((item) => item.id),
    ['three', 'one', 'two'],
  )
  assert.deepEqual(
    moveImage(items, 0, 1).map((item) => item.id),
    ['two', 'one', 'three'],
  )
  assert.deepEqual(
    removeImage(items, 'two').map((item) => item.id),
    ['one', 'three'],
  )
  assert.equal(rotateImage(items[0]).rotation, 90)
  assert.equal(rotateImage({ ...items[0], rotation: 270 }).rotation, 0)
  assert.deepEqual(items.map((item) => item.id), ['one', 'two', 'three'])
})

test('aplica filtros por página o a todo el documento sin mutar archivos ni páginas originales', () => {
  const items = [createItem('one'), createItem('two')]

  const selected = setImageFilter(items, 'two', 'clean-document')
  assert.equal(selected[0]?.filter, 'original')
  assert.equal(selected[1]?.filter, 'clean-document')
  assert.equal(items[1]?.filter, 'original')
  assert.equal(selected[1]?.file, items[1]?.file)

  const all = applyImageFilterToAll(selected, 'grayscale')
  assert.deepEqual(all.map((item) => item.filter), ['grayscale', 'grayscale'])
  assert.deepEqual(items.map((item) => item.filter), ['original', 'original'])
})

test('expone los cinco presets de filtro con una definición reutilizable para preview y canvas', () => {
  assert.deepEqual(
    IMAGE_FILTERS.map((definition) => definition.label),
    ['Original', 'Natural', 'Documento limpio', 'Grises', 'Blanco y negro'],
  )
  assert.equal(getImageFilterCss('original'), 'none')
  assert.notEqual(getImageFilterCss('natural'), getImageFilterCss('original'))
  assert.notEqual(getImageFilterCss('clean-document'), getImageFilterCss('grayscale'))
  assert.notEqual(getImageFilterCss('black-and-white'), getImageFilterCss('grayscale'))
})

test('calcula páginas A4 y Carta según la orientación de cada imagen', () => {
  const portrait = createItem('portrait')
  const landscape = { ...createItem('landscape'), height: 100, width: 200 }
  const rotatedLandscape = { ...landscape, rotation: 90 as const }

  const a4Portrait = getPdfPageLayout(portrait, 'a4', 10)
  assert.equal(a4Portrait.pageWidthPt, 595.28)
  assert.equal(a4Portrait.pageHeightPt, 841.89)
  assert.equal(a4Portrait.marginPt, (10 * 72) / 25.4)

  const letterLandscape = getPdfPageLayout(landscape, 'letter', 0)
  assert.equal(letterLandscape.pageWidthPt, 792)
  assert.equal(letterLandscape.pageHeightPt, 612)
  assert.equal(letterLandscape.contentWidthPt, 792)
  assert.equal(letterLandscape.contentHeightPt, 612)

  const rotatedA4 = getPdfPageLayout(rotatedLandscape, 'a4', 0)
  assert.equal(rotatedA4.pageWidthPt, 595.28)
  assert.equal(rotatedA4.pageHeightPt, 841.89)
})

test('mantiene tamaño de imagen, márgenes y reglas de ajuste', () => {
  const item = { ...createItem('wide'), height: 100, width: 200 }
  const layout = getPdfPageLayout(item, 'image', 5)
  const marginPt = (5 * 72) / 25.4

  assert.equal(layout.pageWidthPt, 200 * (72 / 96) + marginPt * 2)
  assert.equal(layout.pageHeightPt, 100 * (72 / 96) + marginPt * 2)

  const contain = getPdfImageDrawRect(
    getPdfPageLayout(item, 'a4', 10),
    'contain',
  )
  const cover = getPdfImageDrawRect(
    getPdfPageLayout(item, 'a4', 10),
    'cover',
  )
  const stretch = getPdfImageDrawRect(
    getPdfPageLayout(item, 'a4', 10),
    'stretch',
  )

  assert.ok(contain.widthPt <= getPdfPageLayout(item, 'a4', 10).contentWidthPt)
  assert.ok(contain.heightPt <= getPdfPageLayout(item, 'a4', 10).contentHeightPt)
  assert.ok(cover.widthPt >= getPdfPageLayout(item, 'a4', 10).contentWidthPt)
  assert.ok(cover.heightPt >= getPdfPageLayout(item, 'a4', 10).contentHeightPt)
  assert.equal(stretch.widthPt, getPdfPageLayout(item, 'a4', 10).contentWidthPt)
  assert.equal(stretch.heightPt, getPdfPageLayout(item, 'a4', 10).contentHeightPt)
})

test('rechaza una exportación cancelada antes de cargar el procesador PDF', async () => {
  const controller = new AbortController()
  controller.abort()

  await assert.rejects(
    createImagesPdf([createItem('cancelled')], {
      fitMode: 'contain',
      marginMm: 0,
      pagePreset: 'a4',
      signal: controller.signal,
    }),
    (error: unknown) => isPdfExportCancelled(error),
  )
})
