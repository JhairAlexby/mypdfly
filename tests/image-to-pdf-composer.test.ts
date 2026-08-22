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

import {
  createCompositionPdf,
} from '../src/features/image-to-pdf/composer/page-compositor.ts'
import {
  createImageCompositionPage,
  createImagePdfDocument,
  createImagePlacement,
} from '../src/features/image-to-pdf/composer/model.ts'
import type { ImageAsset } from '../src/features/image-to-pdf/core/document.ts'
import { createImageScannerState } from '../src/features/image-to-pdf/core/scanner/geometry.ts'

const POINTS_PER_MM = 72 / 25.4
const createdCanvases: Array<{ height: number; width: number }> = []

const createCanvasElement = (width = 1, height = 1) => {
  const canvas = createCanvas(width, height)
  createdCanvases.push(canvas)
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

const createColorFile = (
  name: string,
  color: string,
  width = 120,
  height = 80,
) => {
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.fillStyle = color
  context.fillRect(0, 0, width, height)
  return new File([canvas.toBuffer('image/png')], name, { type: 'image/png' })
}

const createAsset = (
  id: string,
  color: string,
  filter: ImageAsset['filter'],
) => {
  const file = createColorFile(`${id}.png`, color)
  return {
    file,
    filter,
    height: 80,
    id,
    previewUrl: `blob:${id}`,
    rotation: 0,
    scanner: createImageScannerState(120, 80),
    width: 120,
  } satisfies ImageAsset
}

const pixelAt = (
  canvas: ReturnType<typeof createCanvas>,
  x: number,
  y: number,
) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3))

const channelSpread = (pixel: readonly number[]) =>
  Math.max(...pixel) - Math.min(...pixel)

test('compone varias imágenes en una hoja y conserva los filtros al rasterizar el PDF', async () => {
  createdCanvases.length = 0
  const assets = [
    createAsset('red', '#e11d48', 'original'),
    createAsset('blue', '#2563eb', 'grayscale'),
    createAsset('green', '#16a34a', 'natural'),
  ]
  const page = createImageCompositionPage({
    id: 'sheet-1',
    marginMm: 10,
    placements: [
      createImagePlacement({
        assetId: 'red',
        height: 0.35,
        id: 'red-placement',
        layer: 0,
        width: 0.4,
        x: 0.05,
        y: 0.05,
      }),
      createImagePlacement({
        assetId: 'blue',
        height: 0.35,
        id: 'blue-placement',
        layer: 1,
        width: 0.4,
        x: 0.55,
        y: 0.05,
      }),
      createImagePlacement({
        assetId: 'green',
        height: 0.35,
        id: 'green-placement',
        layer: 2,
        width: 0.9,
        x: 0.05,
        y: 0.55,
      }),
    ],
    preset: 'a4',
  })
  const composition = createImagePdfDocument(assets, [page])
  const progress: number[] = []
  const blob = await createCompositionPdf(composition, {
    fitMode: 'contain',
    onProgress: ({ progress: currentProgress }) => progress.push(currentProgress),
  })

  assert.equal(blob.type, 'application/pdf')
  assert.ok(blob.size > 0)
  assert.deepEqual(progress, [...progress].sort((first, second) => first - second))
  assert.equal(progress.at(-1), 1)

  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  assert.equal(pdf.numPages, 1)
  const pdfPage = await pdf.getPage(1)
  const viewport = pdfPage.getViewport({ scale: 1 })
  assert.equal(Math.round(viewport.width), 595)
  assert.equal(Math.round(viewport.height), 842)
  const rendered = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await pdfPage.render({
    background: '#ffffff',
    canvas: rendered as unknown as HTMLCanvasElement,
    viewport,
  }).promise

  const mmToPixel = (millimeters: number) => millimeters * POINTS_PER_MM
  const normalizedCenter = (x: number, y: number) => ({
    x: mmToPixel(10 + 190 * x),
    y: mmToPixel(10 + 277 * y),
  })
  const red = normalizedCenter(0.25, 0.225)
  const blue = normalizedCenter(0.75, 0.225)
  const green = normalizedCenter(0.5, 0.725)
  const redPixel = pixelAt(rendered, Math.round(red.x), Math.round(red.y))
  const bluePixel = pixelAt(rendered, Math.round(blue.x), Math.round(blue.y))
  const greenPixel = pixelAt(rendered, Math.round(green.x), Math.round(green.y))
  const gapPixel = pixelAt(
    rendered,
    Math.round(normalizedCenter(0.5, 0.225).x),
    Math.round(normalizedCenter(0.5, 0.225).y),
  )
  const marginPixel = pixelAt(rendered, 4, 4)

  assert.ok(redPixel[0] > 120 && redPixel[0] > redPixel[1] + 50)
  assert.ok(channelSpread(bluePixel) <= 5)
  assert.ok(greenPixel[1] > 70 && channelSpread(greenPixel) > 30)
  assert.ok(gapPixel.every((channel) => channel > 240))
  assert.ok(marginPixel.every((channel) => channel > 240))

  assert.ok(createdCanvases.length >= assets.length + 1)
  assert.ok(createdCanvases.every((canvas) => canvas.width === 1 && canvas.height === 1))
  await loadingTask.destroy()
})
