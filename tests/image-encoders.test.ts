import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createCanvas } from '@napi-rs/canvas'

import {
  DEFAULT_JPEG_QUALITY,
  encodeCanvasAsImage,
  encodeCanvasToJpeg,
  encodeCanvasToPng,
} from '../src/components/pdf-editor/image-encoders.ts'
import { ExportCancelledError } from '../src/components/pdf-editor/export-cancellation.ts'

const createEncodedCanvas = () => {
  const canvas = createCanvas(256, 256)
  const context = canvas.getContext('2d')

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      context.fillStyle = `rgb(${(x * 13 + y * 3) % 256}, ${(x * 7 + y * 17) % 256}, ${(x * 19 + y * 5) % 256})`
      context.fillRect(x, y, 1, 1)
    }
  }

  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: (
      callback: BlobCallback,
      type = 'image/png',
      quality?: number,
    ) => {
      const buffer =
        type === 'image/jpeg'
          ? canvas.toBuffer('image/jpeg', Math.round((quality ?? 0.92) * 100))
          : canvas.toBuffer('image/png')

      callback(new Blob([buffer], { type }))
    },
  })

  return canvas as unknown as HTMLCanvasElement
}

const getBytes = async (blob: Blob) =>
  new Uint8Array(await blob.arrayBuffer())

test('codifica PNG con su MIME y firma binaria correctos', async () => {
  const blob = await encodeCanvasToPng(createEncodedCanvas())
  const bytes = await getBytes(blob)

  assert.equal(blob.type, 'image/png')
  assert.deepEqual([...bytes.slice(0, 8)], [
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ])
})

test('codifica JPEG y permite controlar la calidad', async () => {
  const canvas = createEncodedCanvas()
  const highQuality = await encodeCanvasToJpeg(canvas, 0.95)
  const lowQuality = await encodeCanvasToJpeg(canvas, 0.25)
  const bytes = await getBytes(highQuality)

  assert.equal(highQuality.type, 'image/jpeg')
  assert.deepEqual([...bytes.slice(0, 3)], [0xff, 0xd8, 0xff])
  assert.ok(lowQuality.size < highQuality.size)
})

test('normaliza la calidad JPEG antes de delegar en toBlob', async () => {
  const calls: Array<{ quality?: number; type?: string }> = []
  const canvas = {
    toBlob: (
      callback: BlobCallback,
      type?: string,
      quality?: number,
    ) => {
      calls.push({ quality, type })
      callback(new Blob([new Uint8Array([1])], { type: type ?? '' }))
    },
  } as unknown as HTMLCanvasElement

  await encodeCanvasAsImage(canvas, 'jpeg', { quality: 2 })
  await encodeCanvasToJpeg(canvas, -1)

  assert.deepEqual(calls, [
    { quality: 1, type: 'image/jpeg' },
    { quality: 0, type: 'image/jpeg' },
  ])
  assert.equal(DEFAULT_JPEG_QUALITY, 0.9)
})

test('rechaza un blob cuyo MIME no coincide con el formato solicitado', async () => {
  const canvas = {
    toBlob: (callback: BlobCallback) => {
      callback(new Blob([new Uint8Array([1])], { type: 'image/png' }))
    },
  } as unknown as HTMLCanvasElement

  await assert.rejects(
    encodeCanvasToJpeg(canvas),
    /image\/png.*image\/jpeg/,
  )
})

test('cancela una codificación pendiente sin esperar a toBlob', async () => {
  const controller = new AbortController()
  const canvas = {
    toBlob: (callback: BlobCallback) => {
      setTimeout(() => {
        callback(new Blob([new Uint8Array([1])], { type: 'image/png' }))
      }, 20)
    },
  } as unknown as HTMLCanvasElement
  const encoding = encodeCanvasToPng(canvas, { signal: controller.signal })

  controller.abort()

  await assert.rejects(
    encoding,
    (error) =>
      error instanceof ExportCancelledError &&
      error.name === 'ExportCancelledError' &&
      error.message === 'La exportación fue cancelada.',
  )
})
