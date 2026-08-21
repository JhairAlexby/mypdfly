import assert from 'node:assert/strict'
import test from 'node:test'

import { createCanvas } from '@napi-rs/canvas'

import {
  decodeImageFile,
  type ImageSourceDependencies,
} from '../src/features/image-to-pdf/core/image-source.ts'

const createCanvasElement = () => createCanvas(1, 1)

if (typeof document === 'undefined') {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tagName: string) => {
        if (tagName === 'canvas') return createCanvasElement()
        throw new Error(`Elemento no soportado: ${tagName}`)
      },
    },
  })
}

test('usa el adaptador moderno local cuando el navegador no puede decodificar WebP/AVIF', async () => {
  const calls: string[] = []
  const dependencies: ImageSourceDependencies = {
    decodeBrowserImage: async () => {
      throw new Error('decoder del navegador no disponible')
    },
    decodeModernImageFile: async (_file, format) => {
      calls.push(format)
      return {
        height: 1,
        pixels: new Uint8ClampedArray([
          255, 0, 0, 255,
          0, 255, 0, 255,
        ]).buffer,
        width: 2,
      }
    },
  }

  const decoded = await decodeImageFile(
    new File([new Uint8Array([1])], 'entrada.webp', { type: 'image/webp' }),
    undefined,
    dependencies,
  )

  assert.deepEqual({ height: decoded.height, width: decoded.width }, { height: 1, width: 2 })
  assert.match(decoded.previewUrl ?? '', /^data:image\/png/)
  const pixels = (decoded.source as HTMLCanvasElement)
    .getContext('2d')
    ?.getImageData(0, 0, 2, 1).data
  assert.deepEqual(Array.from(pixels ?? []), [
    255, 0, 0, 255,
    0, 255, 0, 255,
  ])
  assert.deepEqual(calls, ['webp'])

  decoded.close()
  assert.equal((decoded.source as HTMLCanvasElement).width, 1)
})

test('preserva el adaptador del navegador cuando está disponible', async () => {
  const source = createCanvas(3, 2)
  const calls: string[] = []
  const dependencies: ImageSourceDependencies = {
    decodeBrowserImage: async () => ({
      close: () => calls.push('close'),
      height: 2,
      source,
      width: 3,
    }),
    decodeModernImageFile: async () => {
      calls.push('modern')
      return {
        height: 2,
        pixels: new ArrayBuffer(3 * 2 * 4),
        width: 3,
      }
    },
  }

  const decoded = await decodeImageFile(
    new File([new Uint8Array([1])], 'entrada.avif', { type: 'image/avif' }),
    undefined,
    dependencies,
  )

  assert.equal(decoded.source, source)
  assert.deepEqual(calls, [])
  decoded.close()
  assert.deepEqual(calls, ['close'])
})
