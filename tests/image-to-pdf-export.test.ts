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
import type { ImageFilter } from '../src/features/image-to-pdf/core/image-filters.ts'
import {
  createImagesPdf,
  type PdfExportProgress,
} from '../src/features/image-to-pdf/core/pdf-export.ts'
import {
  createFullScannerCorners,
  createImageScannerState,
  getPerspectiveOutputSize,
} from '../src/features/image-to-pdf/core/scanner/geometry.ts'
import { renderPerspectiveCanvas } from '../src/features/image-to-pdf/core/scanner/perspective.ts'

const createdDocumentCanvases: Array<{ height: number; width: number }> = []

const createCanvasElement = (width = 1, height = 1) => {
  const canvas = createCanvas(width, height)
  createdDocumentCanvases.push(canvas)
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

const createTinySourceFile = () => {
  const canvas = createCanvas(16, 16)
  const context = canvas.getContext('2d')
  context.fillStyle = '#0f766e'
  context.fillRect(0, 0, canvas.width, canvas.height)
  return new File([canvas.toBuffer('image/png')], 'tiny.png', {
    type: 'image/png',
  })
}

const createBatchItem = (file: File, id: string): ImageDocumentItem => ({
  file,
  filter: 'original',
  height: 16,
  id,
  previewUrl: `blob:${id}`,
  rotation: 0,
  scanner: createImageScannerState(16, 16),
  width: 16,
})

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

test('conserva los cinco filtros seleccionados dentro del PDF generado', async () => {
  const file = createSourceFile()
  const filters = [
    'original',
    'natural',
    'clean-document',
    'grayscale',
    'black-and-white',
  ] as const satisfies readonly ImageFilter[]
  const items = filters.map((filter): ImageDocumentItem => ({
    file,
    filter,
    height: 140,
    id: `filter-${filter}`,
    previewUrl: `blob:${filter}`,
    rotation: 0,
    scanner: createImageScannerState(260, 140),
    width: 260,
  }))

  const blob = await createImagesPdf(items, {
    fitMode: 'stretch',
    marginMm: 0,
    pagePreset: 'image',
  })
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  assert.equal(pdf.numPages, filters.length)

  const samples: number[][] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 4 / 3 })
    const rendered = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    )
    await page.render({
      background: '#ffffff',
      canvas: rendered as unknown as HTMLCanvasElement,
      viewport,
    }).promise
    samples.push(
      Array.from(
        rendered.getContext('2d').getImageData(40, 40, 1, 1).data.slice(0, 3),
      ),
    )
  }

  const [original, natural, cleanDocument, grayscale, blackAndWhite] = samples
  const channelSpread = (sample: readonly number[]) =>
    Math.max(...sample) - Math.min(...sample)

  assert.ok(channelSpread(original) > 100)
  assert.ok(channelSpread(natural) > 100)
  assert.notDeepEqual(natural, original)
  assert.ok(channelSpread(cleanDocument) <= 5)
  assert.ok(channelSpread(grayscale) <= 5)
  assert.ok(channelSpread(blackAndWhite) <= 5)
  assert.notDeepEqual(cleanDocument, grayscale)
  assert.notDeepEqual(blackAndWhite, grayscale)

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

test('renderiza una perspectiva continua sin costuras de la malla', async () => {
  const source = createCanvas(960, 640)
  const sourceContext = source.getContext('2d')
  sourceContext.fillStyle = '#2563eb'
  sourceContext.fillRect(0, 0, source.width, source.height)
  const corners = [
    { x: 180, y: 70 },
    { x: 820, y: 155 },
    { x: 900, y: 590 },
    { x: 80, y: 520 },
  ] as const

  const perspective = await renderPerspectiveCanvas(
    source,
    source.width,
    source.height,
    corners,
  )
  const context = perspective.canvas.getContext('2d')
  const inset = 4
  const pixels = context.getImageData(
    inset,
    inset,
    perspective.canvas.width - inset * 2,
    perspective.canvas.height - inset * 2,
  ).data

  let seamPixels = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    if (red > 80 || green > 130 || blue < 180) seamPixels += 1
  }

  assert.equal(seamPixels, 0)
  perspective.canvas.width = 1
  perspective.canvas.height = 1
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
    filter: 'grayscale',
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
  const rendered = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({
    background: '#ffffff',
    canvas: rendered as unknown as HTMLCanvasElement,
    viewport,
  }).promise
  const pixels = rendered.getContext('2d').getImageData(
    0,
    0,
    rendered.width,
    rendered.height,
  ).data
  for (let index = 0; index < pixels.length; index += 4 * 31) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    assert.ok(Math.max(red, green, blue) - Math.min(red, green, blue) <= 5)
  }
  await loadingTask.destroy()
})

test('conserva una perspectiva continua dentro del PDF rasterizado', async () => {
  const source = createCanvas(960, 640)
  const sourceContext = source.getContext('2d')
  sourceContext.fillStyle = '#2563eb'
  sourceContext.fillRect(0, 0, source.width, source.height)
  const file = new File([source.toBuffer('image/png')], 'scanner-uniform.png', {
    type: 'image/png',
  })
  const corners = [
    { x: 180, y: 70 },
    { x: 820, y: 155 },
    { x: 900, y: 590 },
    { x: 80, y: 520 },
  ] as const
  const item: ImageDocumentItem = {
    file,
    filter: 'original',
    height: source.height,
    id: 'scanner-continuous-pdf',
    previewUrl: 'blob:scanner-continuous-pdf',
    rotation: 0,
    scanner: {
      ...createImageScannerState(source.width, source.height),
      active: true,
      corners,
      detected: true,
    },
    width: source.width,
  }

  const blob = await createImagesPdf([item], {
    fitMode: 'stretch',
    marginMm: 0,
    pagePreset: 'image',
  })
  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 4 / 3 })
  const rendered = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await page.render({
    background: '#ffffff',
    canvas: rendered as unknown as HTMLCanvasElement,
    viewport,
  }).promise

  const inset = 5
  const pixels = rendered.getContext('2d').getImageData(
    inset,
    inset,
    rendered.width - inset * 2,
    rendered.height - inset * 2,
  ).data
  let seamPixels = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index]
    const green = pixels[index + 1]
    const blue = pixels[index + 2]
    if (red > 80 || green > 130 || blue < 180) seamPixels += 1
  }

  assert.equal(seamPixels, 0)
  await loadingTask.destroy()
})

test('cancela el remapeo de perspectiva entre bloques y libera sus lienzos', async () => {
  const source = createCanvas(2000, 1200)
  const sourceContext = source.getContext('2d')
  sourceContext.fillStyle = '#2563eb'
  sourceContext.fillRect(0, 0, source.width, source.height)
  const controller = new AbortController()
  createdDocumentCanvases.length = 0

  const rendering = renderPerspectiveCanvas(
    source,
    source.width,
    source.height,
    [
      { x: 120, y: 80 },
      { x: 1880, y: 130 },
      { x: 1940, y: 1120 },
      { x: 70, y: 1080 },
    ],
    { signal: controller.signal },
  )
  queueMicrotask(() => controller.abort())

  await assert.rejects(
    rendering,
    (error: unknown) => error instanceof Error && error.name === 'ExportCancelledError',
  )
  assert.ok(
    createdDocumentCanvases.length === 2 &&
    createdDocumentCanvases.every((canvas) => canvas.width === 1 && canvas.height === 1),
  )
})

test('procesa un lote grande secuencialmente sin perder páginas ni progreso', async () => {
  const file = createTinySourceFile()
  const items = Array.from({ length: 50 }, (_, index) =>
    createBatchItem(file, `batch-${index}`),
  )
  const progress: PdfExportProgress[] = []
  createdDocumentCanvases.length = 0

  const blob = await createImagesPdf(items, {
    fitMode: 'contain',
    marginMm: 0,
    onProgress: (update) => progress.push(update),
    pagePreset: 'image',
  })

  assert.ok(blob.size > 0)
  assert.ok(
    createdDocumentCanvases.length >= items.length &&
    createdDocumentCanvases.every((canvas) => canvas.width === 1 && canvas.height === 1),
  )
  assert.equal(progress.at(-1)?.stage, 'complete')
  assert.equal(progress.at(-1)?.progress, 1)
  assert.deepEqual(
    progress.map((update) => update.progress),
    [...progress].map((update) => update.progress).sort((a, b) => a - b),
  )

  const loadingTask = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    disableWorker: true,
  })
  const pdf = await loadingTask.promise
  assert.equal(pdf.numPages, 50)
  await loadingTask.destroy()
})

test('cancela un lote grande entre páginas y no publica un PDF completo', async () => {
  const file = createTinySourceFile()
  const items = Array.from({ length: 50 }, (_, index) =>
    createBatchItem(file, `cancel-batch-${index}`),
  )
  const controller = new AbortController()
  const progress: PdfExportProgress[] = []
  createdDocumentCanvases.length = 0

  await assert.rejects(
    createImagesPdf(items, {
      fitMode: 'contain',
      marginMm: 0,
      onProgress: (update) => {
        progress.push(update)
        if (
          update.stage === 'rendering' &&
          update.currentPage === 4 &&
          update.progress > 0
        ) {
          controller.abort()
        }
      },
      pagePreset: 'image',
      signal: controller.signal,
    }),
    (error: unknown) => error instanceof Error && error.name === 'ExportCancelledError',
  )
  assert.ok(progress.every((update) => update.stage !== 'complete'))
  assert.ok(progress.length < items.length * 2)
  assert.ok(
    createdDocumentCanvases.every((canvas) => canvas.width === 1 && canvas.height === 1),
  )
})
