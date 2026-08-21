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
import {
  createFullScannerCorners,
  createImageScannerState,
  getPerspectiveOutputSize,
} from '../src/features/image-to-pdf/core/scanner/geometry.ts'
import { renderPerspectiveCanvas } from '../src/features/image-to-pdf/core/scanner/perspective.ts'

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
    scanner: createImageScannerState(260, 140),
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

test('renderiza una perspectiva local a partir de esquinas manuales', async () => {
  const source = createCanvas(120, 80)
  const sourceContext = source.getContext('2d')
  sourceContext.fillStyle = '#1d4ed8'
  sourceContext.fillRect(0, 0, source.width, source.height)
  const corners = [
    { x: 12, y: 8 },
    { x: 108, y: 10 },
    { x: 114, y: 72 },
    { x: 6, y: 70 },
  ] as const

  const perspective = await renderPerspectiveCanvas(
    source,
    source.width,
    source.height,
    corners,
  )
  const expected = getPerspectiveOutputSize(corners)
  assert.equal(perspective.logicalWidth, expected.width)
  assert.equal(perspective.logicalHeight, expected.height)
  assert.ok(perspective.canvas.width > 0)
  assert.ok(perspective.canvas.height > 0)

  const center = perspective.canvas
    .getContext('2d')
    .getImageData(
      Math.floor(perspective.canvas.width / 2),
      Math.floor(perspective.canvas.height / 2),
      1,
      1,
    ).data
  assert.ok(center[2] > 150)
  perspective.canvas.width = 1
  perspective.canvas.height = 1

  const identity = await renderPerspectiveCanvas(
    source,
    source.width,
    source.height,
    createFullScannerCorners(source.width, source.height),
  )
  assert.ok(identity.canvas.width >= 79)
  assert.ok(identity.canvas.height >= 49)
  identity.canvas.width = 1
  identity.canvas.height = 1
})

test('integra la perspectiva activa en el PDF con el tamaño real del recorte', async () => {
  const file = createSourceFile()
  const corners = [
    { x: 10, y: 10 },
    { x: 232, y: 7 },
    { x: 240, y: 126 },
    { x: 5, y: 120 },
  ] as const
  const scanner = {
    ...createImageScannerState(260, 140),
    active: true,
    corners,
  }
  const item: ImageDocumentItem = {
    file,
    filter: 'original',
    height: 140,
    id: 'perspective',
    previewUrl: 'blob:perspective',
    rotation: 0,
    scanner,
    width: 260,
  }

  const blob = await createImagesPdf([item], {
    fitMode: 'contain',
    marginMm: 0,
    pagePreset: 'image',
  })
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const output = getPerspectiveOutputSize(corners)
  assert.equal(Math.round(viewport.width), Math.round(output.width * (72 / 96)))
  assert.equal(Math.round(viewport.height), Math.round(output.height * (72 / 96)))
  await loadingTask.destroy()
})
