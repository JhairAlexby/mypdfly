import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas'
import { PDFDocument, rgb } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import type {
  Annotation,
  PdfPageReference,
  PdfSource,
} from '../src/components/pdf-editor/types.ts'

type TestCanvas = ReturnType<typeof createCanvas>

type TestAnchor = {
  href: string
  download: string
  click: () => void
  remove: () => void
}

let lastDownloadUrl: string | null = null

const createTestCanvas = (width: number, height: number) => {
  const canvas = createCanvas(width, height)

  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: (callback: (blob: Blob | null) => void) => {
      callback(
        new Blob([canvas.toBuffer('image/png')], {
          type: 'image/png',
        }),
      )
    },
  })

  return canvas
}

const documentShim = {
  body: {
    appendChild: () => undefined,
  },
  createElement: (tagName: string): TestCanvas | TestAnchor => {
    if (tagName === 'canvas') return createTestCanvas(1, 1)

    if (tagName === 'a') {
      const anchor: TestAnchor = {
        href: '',
        download: '',
        click: () => {
          lastDownloadUrl = anchor.href
        },
        remove: () => undefined,
      }
      return anchor
    }

    throw new Error(`Elemento no soportado por el entorno de pruebas: ${tagName}`)
  },
}

Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: documentShim,
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    requestAnimationFrame: (callback: (time: number) => void) => {
      callback(0)
      return 0
    },
    setTimeout,
  },
})
Object.defineProperty(globalThis, 'Path2D', {
  configurable: true,
  value: Path2D,
})
Object.defineProperty(globalThis, 'ImageData', {
  configurable: true,
  value: ImageData,
})
Object.defineProperty(globalThis, 'DOMMatrix', {
  configurable: true,
  value: DOMMatrix,
})

const { renderEditedPage } = await import(
  '../src/components/pdf-editor/page-compositor.ts'
)
const { exportEditedPdf } = await import(
  '../src/components/pdf-editor/export-pdf.ts'
)

const createFixture = async () => {
  const fixturePdf = await PDFDocument.create()
  const firstPage = fixturePdf.addPage([180, 120])
  firstPage.drawRectangle({
    color: rgb(0.93, 0.96, 1),
    height: 120,
    width: 180,
    x: 0,
    y: 0,
  })
  firstPage.drawRectangle({
    color: rgb(0.94, 0.31, 0.22),
    height: 30,
    width: 52,
    x: 14,
    y: 18,
  })
  firstPage.drawEllipse({
    color: rgb(0.16, 0.47, 0.84),
    x: 130,
    xScale: 25,
    y: 86,
    yScale: 18,
  })
  firstPage.drawLine({
    color: rgb(0.12, 0.18, 0.28),
    end: { x: 162, y: 22 },
    start: { x: 26, y: 104 },
    thickness: 2,
  })

  const secondPage = fixturePdf.addPage([240, 140])
  secondPage.drawRectangle({
    color: rgb(1, 0.95, 0.86),
    height: 140,
    width: 240,
    x: 0,
    y: 0,
  })

  const thirdPage = fixturePdf.addPage([160, 220])
  thirdPage.drawRectangle({
    color: rgb(0.9, 1, 0.92),
    height: 220,
    width: 160,
    x: 0,
    y: 0,
  })

  const bytes = await fixturePdf.save()
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
  })
  const document = await loadingTask.promise
  const source = {
    id: 'fixture-source',
    file: { name: 'fixture.pdf', size: bytes.byteLength } as File,
    document,
  } as unknown as PdfSource

  return { loadingTask, source }
}

const getPageReference = (
  sourcePageNumber: number,
  id = `fixture-page-${sourcePageNumber}`,
): PdfPageReference => ({
  id,
  sourceId: 'fixture-source',
  sourcePageNumber,
})

const getPixelHash = (canvas: TestCanvas) => {
  const context = canvas.getContext('2d')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  return createHash('sha256').update(imageData.data).digest('hex')
}

const visualSnapshot = {
  height: 240,
  pixelHash:
    'f85232404bb715b858dbcb003090703fb14b23c85f18eacaee47b8bdc47df50b',
  width: 360,
}

const visualAnnotations: Annotation[] = [
  {
    end: { x: 0.72, y: 0.78 },
    format: { color: '#2563eb', opacity: 0.58, strokeWidth: 3 },
    id: 'circle',
    layer: 1,
    pageId: 'visual-page',
    start: { x: 0.16, y: 0.14 },
    type: 'circle',
  },
  {
    end: { x: 0.63, y: 0.68 },
    format: { color: '#ff5a45', opacity: 0.7, strokeWidth: 4 },
    id: 'rectangle',
    layer: 2,
    pageId: 'visual-page',
    start: { x: 0.28, y: 0.27 },
    type: 'rectangle',
  },
  {
    end: { x: 0.86, y: 0.2 },
    format: { color: '#111827', opacity: 1, strokeWidth: 3 },
    id: 'line',
    layer: 3,
    pageId: 'visual-page',
    start: { x: 0.1, y: 0.86 },
    type: 'line',
  },
  {
    end: { x: 0.46, y: 0.58 },
    format: { intensity: 5 },
    id: 'blur',
    layer: 4,
    pageId: 'visual-page',
    start: { x: 0.08, y: 0.34 },
    type: 'blur',
  },
  {
    end: { x: 0.92, y: 0.94 },
    format: { color: '#111827', effect: 'clean', strokeWidth: 8 },
    id: 'signature',
    layer: 5,
    pageId: 'visual-page',
    start: { x: 0.08, y: 0.57 },
    strokes: [
      [
        { pressure: 0.8, x: 0.04, y: 0.58 },
        { pressure: 0.9, x: 0.22, y: 0.28 },
        { pressure: 0.7, x: 0.43, y: 0.72 },
        { pressure: 0.85, x: 0.68, y: 0.25 },
        { pressure: 0.8, x: 0.94, y: 0.56 },
      ],
    ],
    type: 'signature',
  },
]

test('mantiene la apariencia compositada de una página', async () => {
  const { loadingTask, source } = await createFixture()

  try {
    const page = await renderEditedPage({
      annotations: visualAnnotations,
      pageReference: getPageReference(1, 'visual-page'),
      source,
    })

    assert.equal(page.canvas.width, visualSnapshot.width)
    assert.equal(page.canvas.height, visualSnapshot.height)
    assert.equal(getPixelHash(page.canvas), visualSnapshot.pixelHash)

    page.canvas.width = 1
    page.canvas.height = 1
  } finally {
    await loadingTask.destroy()
  }
})

test('exporta las páginas en el orden recibido', async () => {
  const { loadingTask, source } = await createFixture()
  const orderedPages = [
    getPageReference(3),
    getPageReference(1),
    getPageReference(2),
  ]
  const progress: string[] = []

  try {
    lastDownloadUrl = null
    await exportEditedPdf({
      annotations: [],
      fileName: 'fixture-ordenado.pdf',
      onProgress: (currentPage, totalPages) => {
        progress.push(`${currentPage}/${totalPages}`)
      },
      pages: orderedPages,
      sources: [source],
    })

    assert.deepEqual(progress, ['1/3', '2/3', '3/3'])
    assert.ok(lastDownloadUrl)

    const response = await fetch(lastDownloadUrl)
    const exportedPdf = await PDFDocument.load(await response.arrayBuffer())
    const sizes = exportedPdf.getPages().map((page) => {
      const size = page.getSize()
      return [Math.round(size.width), Math.round(size.height)]
    })

    assert.deepEqual(sizes, [
      [160, 220],
      [180, 120],
      [240, 140],
    ])
  } finally {
    await loadingTask.destroy()
  }
})
