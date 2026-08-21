import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  moveImage,
  removeImage,
  rotateImage,
  validateImageFile,
  type ImageDocumentItem,
} from '../src/features/image-to-pdf/core/document.ts'

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
