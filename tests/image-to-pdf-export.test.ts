import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createCanvas,
  DOMMatrix,
  ImageData,
  loadImage,
  Path2D,
} from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import type { ImageDocumentItem } from '../src/features/image-to-pdf/core/document.ts'
import { createImagesPdf } from '../src/features/image-to-pdf/core/pdf-export.ts'

const createCanvasElement = (width = 1, height = 1) => {
  const canvas = createCanvas(width, height)
  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: (callback: (blob: Blob | null) => void) => {
      callback(new Blob([canvas.toBuffer('image/png')], { type: 'image/png' }))
    },
  })
  return canvas
}

Object.defineProperty(globalThis, 'DOMMatrix', {
  configurable: true,
  value: DOMMatrix,
})
Object.defineProperty(globalThis, 'ImageData', {
  configurable: true,
  value: ImageData,
})
Object.defineProperty(globalThis, 'Path2D', {
  configurable: true,
  value: Path2D,
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    createElement: (tagName: string) => {
      if (tagName === 'canvas') return createCanvasElement()
      throw new Error(`Elemento no soportado: ${tagName}`)
    },
  },
})
Object.defineProperty(globalThis, 'createImageBitmap', {
  configurable: true,
  value: async (file: File) => {
    const image = await loadImage(Buffer.from(await file.arrayBuffer()))
    return Object.assign(image, { close: () => undefined })
  },
})

const createSourceFile = () => {
  const canvas = createCanvas(260, 140)
  const context = canvas.getContext('2d')
  context.fillStyle = '#f1f5f9'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#111827'
  context.fillRect(0, 60, canvas.width, 20)
  context.fillStyle = '#e84c38'
  context.fillRect(24, 24, 52, 36)
  return new File([canvas.toBuffer('image/png')], 'sample.png', {
    type: 'image/png',
  })
}

test('genera un PDF con progreso monotónico y orientación A4 automática', async () => {
  const file = createSourceFile()
  const item: ImageDocumentItem = {
    file,
    filter: 'grayscale',
    height: 140,
    id: 'sample',
    previewUrl: 'blob:sample',
    rotation: 0,
    width: 260,
  }
  const progress: number[] = []

  const blob = await createImagesPdf([item], {
    fitMode: 'contain',
    marginMm: 10,
    onProgress: ({ progress: currentProgress }) => progress.push(currentProgress),
    pagePreset: 'a4',
  })

  assert.equal(blob.type, 'application/pdf')
  assert.ok(blob.size > 0)
  assert.deepEqual(progress, [...progress].sort((a, b) => a - b))
  assert.equal(progress.at(-1), 1)

  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  assert.equal(pdf.numPages, 1)

  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  assert.equal(Math.round(viewport.width), 842)
  assert.equal(Math.round(viewport.height), 595)

  const rendered = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({
    background: '#ffffff',
    canvas: rendered as unknown as HTMLCanvasElement,
    viewport,
  }).promise

  const renderedContext = rendered.getContext('2d')
  const centerPixel = renderedContext.getImageData(
    Math.floor(rendered.width / 2),
    Math.floor(rendered.height / 2),
    1,
    1,
  ).data
  const marginPixel = renderedContext.getImageData(4, 4, 1, 1).data
  const filteredPixel = renderedContext.getImageData(120, 180, 1, 1).data
  assert.ok(centerPixel[0] < 80 && centerPixel[1] < 80 && centerPixel[2] < 80)
  assert.ok(marginPixel[0] > 240 && marginPixel[1] > 240 && marginPixel[2] > 240)
  assert.ok(Math.max(...filteredPixel.slice(0, 3)) - Math.min(...filteredPixel.slice(0, 3)) <= 3)

  await loadingTask.destroy()
})
