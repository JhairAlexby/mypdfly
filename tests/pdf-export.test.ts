import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas'
import { unzipSync } from 'fflate'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

import type {
  Annotation,
  PdfPageReference,
  PdfSource,
} from '../src/components/pdf-editor/types.ts'
import { fontFamilies } from '../src/components/pdf-editor/constants.ts'

type TestCanvas = ReturnType<typeof createCanvas>

type TestAnchor = {
  href: string
  download: string
  click: () => void
  remove: () => void
}

let lastDownloadUrl: string | null = null
let lastDownloadName: string | null = null

const createTestCanvas = (width: number, height: number) => {
  const canvas = createCanvas(width, height)

  Object.defineProperty(canvas, 'toBlob', {
    configurable: true,
    value: (
      callback: (blob: Blob | null) => void,
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
          lastDownloadName = anchor.download
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
const { exportEditedImages } = await import(
  '../src/components/pdf-editor/export-images.ts'
)
const { ExportCancelledError } = await import(
  '../src/components/pdf-editor/export-cancellation.ts'
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

type FixturePageConfig = {
  width: number
  height: number
  color: [number, number, number]
  rotation?: number
}

const createSourceFixture = async (
  id: string,
  fileName: string,
  pageConfigs: FixturePageConfig[],
) => {
  const fixturePdf = await PDFDocument.create()

  pageConfigs.forEach(({ color, height, rotation = 0, width }, index) => {
    const page = fixturePdf.addPage([width, height])
    if (rotation) page.setRotation(degrees(rotation))

    page.drawRectangle({
      color: rgb(...color),
      height,
      width,
      x: 0,
      y: 0,
    })
    page.drawLine({
      color: rgb(0.1, 0.12, 0.2),
      end: { x: width * 0.9, y: height * 0.15 },
      start: { x: width * 0.1, y: height * 0.85 },
      thickness: Math.max(1, Math.min(width, height) / 80),
    })
    page.drawRectangle({
      color: rgb(0.98, 0.98, 0.98),
      height: Math.max(8, height * 0.08),
      width: Math.max(8, width * 0.08),
      x: width * 0.08 + (index % 3) * width * 0.04,
      y: height * 0.08,
    })
  })

  const bytes = await fixturePdf.save()
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
  })
  const document = await loadingTask.promise
  const source = {
    id,
    file: { name: fileName, size: bytes.byteLength } as File,
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

const getSourcePageReference = (
  sourceId: string,
  sourcePageNumber: number,
  id = `${sourceId}-page-${sourcePageNumber}`,
): PdfPageReference => ({
  id,
  sourceId,
  sourcePageNumber,
})

const getPixelHash = (canvas: TestCanvas) => {
  const context = canvas.getContext('2d')
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

  return createHash('sha256').update(imageData.data).digest('hex')
}

const countDarkPixels = (
  canvas: TestCanvas,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
) => {
  const context = canvas.getContext('2d')
  const imageData = context.getImageData(
    Math.floor(startX * canvas.width),
    Math.floor(startY * canvas.height),
    Math.max(1, Math.floor((endX - startX) * canvas.width)),
    Math.max(1, Math.floor((endY - startY) * canvas.height)),
  )
  let darkPixels = 0

  for (let index = 0; index < imageData.data.length; index += 4) {
    if (
      imageData.data[index] < 120 &&
      imageData.data[index + 1] < 120 &&
      imageData.data[index + 2] < 120 &&
      imageData.data[index + 3] > 0
    ) {
      darkPixels += 1
    }
  }

  return darkPixels
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

const allAnnotations: Annotation[] = [
  {
    end: { x: 0.38, y: 0.34 },
    format: { color: '#ef4444', opacity: 1, strokeWidth: 3 },
    id: 'layer-under',
    layer: 1,
    pageId: 'all-annotations',
    start: { x: 0.08, y: 0.08 },
    type: 'rectangle',
  },
  {
    end: { x: 0.34, y: 0.3 },
    format: { color: '#2563eb', opacity: 1, strokeWidth: 3 },
    id: 'layer-over',
    layer: 2,
    pageId: 'all-annotations',
    start: { x: 0.12, y: 0.12 },
    type: 'circle',
  },
  {
    end: { x: 0.64, y: 0.3 },
    format: { color: '#16a34a', opacity: 0.8, strokeWidth: 4 },
    id: 'triangle',
    layer: 3,
    pageId: 'all-annotations',
    start: { x: 0.43, y: 0.08 },
    type: 'triangle',
  },
  {
    end: { x: 0.93, y: 0.1 },
    format: { color: '#111827', opacity: 1, strokeWidth: 3 },
    id: 'line',
    layer: 4,
    pageId: 'all-annotations',
    start: { x: 0.68, y: 0.3 },
    type: 'line',
  },
  {
    end: { x: 0.36, y: 0.62 },
    format: { intensity: 7 },
    id: 'blur',
    layer: 5,
    pageId: 'all-annotations',
    start: { x: 0.08, y: 0.4 },
    type: 'blur',
  },
  {
    end: { x: 0.62, y: 0.7 },
    format: { color: '#7c3aed', effect: 'clean', strokeWidth: 8 },
    id: 'signature-clean',
    layer: 6,
    pageId: 'all-annotations',
    start: { x: 0.4, y: 0.4 },
    strokes: [
      [
        { pressure: 0.8, x: 0.06, y: 0.72 },
        { pressure: 0.9, x: 0.28, y: 0.18 },
        { pressure: 0.7, x: 0.53, y: 0.78 },
        { pressure: 0.85, x: 0.9, y: 0.25 },
      ],
    ],
    type: 'signature',
  },
  {
    end: { x: 0.94, y: 0.7 },
    format: { color: '#c2410c', effect: 'natural', strokeWidth: 7 },
    id: 'signature-natural',
    layer: 7,
    pageId: 'all-annotations',
    start: { x: 0.67, y: 0.4 },
    strokes: [
      [
        { pressure: 0.7, x: 0.06, y: 0.62 },
        { pressure: 0.95, x: 0.22, y: 0.22 },
        { pressure: 0.65, x: 0.46, y: 0.7 },
        { pressure: 0.9, x: 0.7, y: 0.18 },
        { pressure: 0.8, x: 0.94, y: 0.56 },
      ],
    ],
    type: 'signature',
  },
  ...fontFamilies.map((font, index): Annotation => ({
    id: `font-${font.value}`,
    pageId: 'all-annotations',
    type: 'text',
    x: 0.06,
    y: 0.74 + index * 0.045,
    text: `${font.label} Aa`,
    format: {
      bold: index % 2 === 0,
      color: '#111827',
      fontFamily: font.value,
      fontSize: 16,
      italic: index % 2 === 1,
      underline: index % 3 === 0,
    },
    layer: 10 + index,
  })),
].reverse()

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

test('conserva las dimensiones de páginas verticales, horizontales y rotadas', async () => {
  const { loadingTask, source } = await createSourceFixture(
    'orientation-source',
    'orientaciones.pdf',
    [
      { color: [0.93, 0.96, 1], height: 240, width: 160 },
      { color: [1, 0.95, 0.86], height: 180, width: 320 },
      { color: [0.9, 1, 0.92], height: 160, rotation: 90, width: 240 },
      { color: [0.98, 0.92, 0.96], height: 240, rotation: 180, width: 160 },
      { color: [0.94, 0.94, 1], height: 160, rotation: 270, width: 240 },
    ],
  )
  const expectedCanvasSizes = [
    [320, 480],
    [640, 360],
    [320, 480],
    [320, 480],
    [320, 480],
  ]

  try {
    const renderedPages: Array<[number, number]> = []

    for (let pageNumber = 1; pageNumber <= 5; pageNumber += 1) {
      const page = await renderEditedPage({
        annotations: [],
        pageReference: getSourcePageReference(
          'orientation-source',
          pageNumber,
        ),
        source,
      })
      renderedPages.push([page.canvas.width, page.canvas.height])
      assert.ok(getPixelHash(page.canvas).length > 0)
      page.canvas.width = 1
      page.canvas.height = 1
    }

    assert.deepEqual(renderedPages, expectedCanvasSizes)
  } finally {
    await loadingTask.destroy()
  }
})

test('compone todas las anotaciones, fuentes y capas en el orden correcto', async () => {
  const { loadingTask, source } = await createSourceFixture(
    'all-annotations-source',
    'anotaciones.pdf',
    [{ color: [0.95, 0.96, 0.98], height: 720, width: 480 }],
  )

  try {
    const page = await renderEditedPage({
      annotations: allAnnotations,
      pageReference: getSourcePageReference(
        'all-annotations-source',
        1,
        'all-annotations',
      ),
      source,
    })

    assert.deepEqual([page.canvas.width, page.canvas.height], [960, 1440])
    assert.deepEqual(
      new Set(allAnnotations.map((annotation) => annotation.type)),
      new Set(['rectangle', 'circle', 'triangle', 'line', 'blur', 'signature', 'text']),
    )

    const context = page.canvas.getContext('2d')
    const overlapPixel = context.getImageData(
      Math.floor(page.canvas.width * 0.24),
      Math.floor(page.canvas.height * 0.21),
      1,
      1,
    ).data
    assert.ok(overlapPixel[2] > overlapPixel[0])
    assert.ok(overlapPixel[2] > overlapPixel[1])

    fontFamilies.forEach((font, index) => {
      const rowStart = 0.72 + index * 0.045
      assert.ok(
        countDarkPixels(page.canvas, 0.03, rowStart, 0.5, rowStart + 0.04) > 0,
        `No se encontró texto renderizado para ${font.label}`,
      )
    })
  } finally {
    await loadingTask.destroy()
  }
})

test('exporta páginas combinadas de varias fuentes conservando su orden', async () => {
  const first = await createSourceFixture(
    'combined-first',
    'primero.pdf',
    [
      { color: [0.93, 0.96, 1], height: 220, width: 120 },
      { color: [1, 0.95, 0.86], height: 160, width: 300 },
    ],
  )
  const second = await createSourceFixture(
    'combined-second',
    'segundo.pdf',
    [
      { color: [0.9, 1, 0.92], height: 100, width: 200 },
      { color: [0.98, 0.92, 0.96], height: 260, width: 140 },
    ],
  )
  const orderedPages = [
    getSourcePageReference('combined-second', 2),
    getSourcePageReference('combined-first', 1),
    getSourcePageReference('combined-second', 1),
    getSourcePageReference('combined-first', 2),
  ]
  const progress: string[] = []

  try {
    lastDownloadUrl = null
    await exportEditedPdf({
      annotations: [],
      fileName: 'primero-combinado-editado.pdf',
      onProgress: (currentPage, totalPages) => {
        progress.push(`${currentPage}/${totalPages}`)
      },
      pages: orderedPages,
      sources: [first.source, second.source],
    })

    assert.deepEqual(progress, ['1/4', '2/4', '3/4', '4/4'])
    assert.ok(lastDownloadUrl)

    const response = await fetch(lastDownloadUrl)
    const exportedPdf = await PDFDocument.load(await response.arrayBuffer())
    const sizes = exportedPdf.getPages().map((page) => {
      const size = page.getSize()
      return [Math.round(size.width), Math.round(size.height)]
    })

    assert.deepEqual(sizes, [
      [140, 260],
      [120, 220],
      [200, 100],
      [300, 160],
    ])
  } finally {
    await first.loadingTask.destroy()
    await second.loadingTask.destroy()
  }
})

test('exporta un documento extenso sin perder páginas ni progreso', async () => {
  const pageCount = 32
  const pageConfigs = Array.from({ length: pageCount }, (_, index) => ({
    color: [
      0.9 + (index % 3) * 0.02,
      0.93 + (index % 2) * 0.02,
      0.98,
    ] as [number, number, number],
    height: 128,
    width: 96,
  }))
  const { loadingTask, source } = await createSourceFixture(
    'long-source',
    'documento-largo.pdf',
    pageConfigs,
  )
  const progress: string[] = []

  try {
    lastDownloadUrl = null
    await exportEditedPdf({
      annotations: [],
      fileName: 'documento-largo-editado.pdf',
      onProgress: (currentPage, totalPages) => {
        progress.push(`${currentPage}/${totalPages}`)
      },
      pages: pageConfigs.map((_, index) =>
        getSourcePageReference('long-source', index + 1),
      ),
      sources: [source],
    })

    assert.deepEqual(progress, [
      '1/32',
      ...Array.from({ length: 30 }, (_, index) => `${index + 2}/32`),
      '32/32',
    ])
    assert.ok(lastDownloadUrl)

    const response = await fetch(lastDownloadUrl)
    const exportedPdf = await PDFDocument.load(await response.arrayBuffer())
    assert.equal(exportedPdf.getPageCount(), pageCount)
    assert.deepEqual(exportedPdf.getPage(0).getSize(), { height: 128, width: 96 })
    assert.deepEqual(exportedPdf.getPage(pageCount - 1).getSize(), {
      height: 128,
      width: 96,
    })
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

test('exporta únicamente las páginas que permanecen en el manifiesto', async () => {
  const { loadingTask, source } = await createFixture()
  const remainingPages = [getPageReference(1), getPageReference(3)]

  try {
    lastDownloadUrl = null
    await exportEditedPdf({
      annotations: [],
      fileName: 'fixture-sin-pagina-2.pdf',
      pages: remainingPages,
      sources: [source],
    })

    assert.ok(lastDownloadUrl)
    const response = await fetch(lastDownloadUrl)
    const exportedPdf = await PDFDocument.load(await response.arrayBuffer())
    const sizes = exportedPdf.getPages().map((page) => {
      const size = page.getSize()
      return [Math.round(size.width), Math.round(size.height)]
    })

    assert.deepEqual(sizes, [
      [180, 120],
      [160, 220],
    ])
  } finally {
    await loadingTask.destroy()
  }
})

test('descarga directamente la imagen cuando solo hay una página', async () => {
  const { loadingTask, source } = await createFixture()

  try {
    lastDownloadUrl = null
    lastDownloadName = null

    await exportEditedImages({
      annotations: [],
      fileName: 'fixture.pdf',
      format: 'png',
      pages: [getPageReference(1)],
      sources: [source],
    })

    assert.equal(lastDownloadName, 'fixture-editado.png')
    assert.ok(lastDownloadUrl)

    const response = await fetch(lastDownloadUrl)
    const bytes = new Uint8Array(await response.arrayBuffer())
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
  } finally {
    await loadingTask.destroy()
  }
})

test('empaqueta varias páginas en un ZIP JPEG ordenado', async () => {
  const { loadingTask, source } = await createFixture()
  const orderedPages = [
    getPageReference(3),
    getPageReference(1),
    getPageReference(2),
  ]
  const progress: string[] = []

  try {
    lastDownloadUrl = null
    lastDownloadName = null

    await exportEditedImages({
      annotations: [],
      fileName: 'fixture.pdf',
      format: 'jpeg',
      onProgress: (currentPage, totalPages) => {
        progress.push(`${currentPage}/${totalPages}`)
      },
      pages: orderedPages,
      sources: [source],
    })

    assert.deepEqual(progress, ['1/3', '2/3', '3/3'])
    assert.equal(lastDownloadName, 'fixture-editado.zip')
    assert.ok(lastDownloadUrl)

    const response = await fetch(lastDownloadUrl)
    const archive = unzipSync(
      new Uint8Array(await response.arrayBuffer()),
    )
    const names = Object.keys(archive)
    const expectedNames = [
      'fixture-editado-pagina-01.jpg',
      'fixture-editado-pagina-02.jpg',
      'fixture-editado-pagina-03.jpg',
    ]

    assert.deepEqual(names, expectedNames)
    for (const name of expectedNames) {
      assert.deepEqual([...archive[name].slice(0, 3)], [0xff, 0xd8, 0xff])
    }
  } finally {
    await loadingTask.destroy()
  }
})

test('cancela la exportación antes de iniciar la composición', async () => {
  const { loadingTask, source } = await createFixture()
  const controller = new AbortController()
  controller.abort()

  try {
    lastDownloadUrl = null

    await assert.rejects(
      exportEditedImages({
        annotations: [],
        fileName: 'fixture.pdf',
        format: 'png',
        pages: [getPageReference(1)],
        signal: controller.signal,
        sources: [source],
      }),
      (error) => error instanceof ExportCancelledError,
    )
    assert.equal(lastDownloadUrl, null)
  } finally {
    await loadingTask.destroy()
  }
})

test('cancela la exportación entre páginas y no descarga un ZIP parcial', async () => {
  const { loadingTask, source } = await createFixture()
  const controller = new AbortController()

  try {
    lastDownloadUrl = null

    await assert.rejects(
      exportEditedImages({
        annotations: [],
        fileName: 'fixture.pdf',
        format: 'png',
        onProgress: (currentPage) => {
          if (currentPage === 1) controller.abort()
        },
        pages: [
          getPageReference(1),
          getPageReference(2),
          getPageReference(3),
        ],
        signal: controller.signal,
        sources: [source],
      }),
      (error) => error instanceof ExportCancelledError,
    )
    assert.equal(lastDownloadUrl, null)
  } finally {
    await loadingTask.destroy()
  }
})

test('cancela la exportación PDF antes de guardar el resultado', async () => {
  const { loadingTask, source } = await createFixture()
  const controller = new AbortController()

  try {
    lastDownloadUrl = null

    await assert.rejects(
      exportEditedPdf({
        annotations: [],
        fileName: 'fixture-editado.pdf',
        onProgress: () => controller.abort(),
        pages: [getPageReference(1)],
        signal: controller.signal,
        sources: [source],
      }),
      (error) => error instanceof ExportCancelledError,
    )
    assert.equal(lastDownloadUrl, null)
  } finally {
    await loadingTask.destroy()
  }
})
