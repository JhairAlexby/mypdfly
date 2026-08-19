import { test } from 'node:test'
import assert from 'node:assert/strict'

import { unzipSync } from 'fflate'

import {
  createZipArchive,
  getUniqueArchiveFileNames,
} from '../src/lib/files/zip.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'

const decode = (value: Uint8Array) => new TextDecoder().decode(value)

test('crea un ZIP válido y resuelve nombres duplicados', async () => {
  const archive = await createZipArchive([
    { blob: new Blob(['primero']), fileName: 'resultado.pdf' },
    { blob: new Blob(['segundo']), fileName: 'resultado.pdf' },
  ])
  const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()))

  assert.equal(archive.type, 'application/zip')
  assert.deepEqual(Object.keys(entries), [
    'resultado.pdf',
    'resultado (2).pdf',
  ])
  assert.equal(decode(entries['resultado.pdf']), 'primero')
  assert.equal(decode(entries['resultado (2).pdf']), 'segundo')
})

test('sanea rutas y conserva extensiones al deduplicar', () => {
  assert.deepEqual(
    getUniqueArchiveFileNames([
      '../reporte final.PDF',
      '../reporte final.PDF',
      'sin-extension',
      'sin-extension',
    ]),
    [
      '..-reporte final.PDF',
      '..-reporte final (2).pdf',
      'sin-extension',
      'sin-extension (2)',
    ],
  )
})

test('evita colisiones con un nombre sufijado que ya existe', () => {
  assert.deepEqual(
    getUniqueArchiveFileNames([
      'resultado.pdf',
      'resultado (2).pdf',
      'resultado.pdf',
    ]),
    [
      'resultado.pdf',
      'resultado (2).pdf',
      'resultado (3).pdf',
    ],
  )
})

test('cancela la creación del ZIP entre archivos', async () => {
  const controller = new AbortController()
  const archive = createZipArchive(
    [
      { blob: new Blob(['primero']), fileName: 'uno.txt' },
      { blob: new Blob(['segundo']), fileName: 'dos.txt' },
    ],
    {
      onProgress: (completed) => {
        if (completed === 1) controller.abort()
      },
      signal: controller.signal,
    },
  )

  await assert.rejects(
    archive,
    (error) => error instanceof OperationCancelledError,
  )
})
