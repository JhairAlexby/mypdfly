import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PDFDocument, StandardFonts } from 'pdf-lib'

import {
  CompressionCoreError,
  CompressionJob,
  CompressionProcessorRegistry,
  validateCompressionFile,
  type CompressionProgressUpdate,
} from '../src/features/file-compression/core/index.ts'
import {
  createPdfCompressionProcessor,
  inspectPdfFile,
  registerPdfCompressionProcessor,
  type PdfProcessorDependencies,
} from '../src/features/file-compression/processors/index.ts'

const createControlledPdf = async () => {
  const document = await PDFDocument.create({ updateMetadata: false })
  const font = await document.embedFont(StandardFonts.Helvetica)
  document.setTitle('PDF estructural de prueba')

  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    const page = document.addPage([612, 792])
    for (let row = 0; row < 20; row += 1) {
      page.drawText(`Página ${pageIndex + 1}, registro ${row + 1}`, {
        font,
        size: 10,
        x: 48,
        y: 730 - row * 28,
      })
    }
  }

  const form = document.getForm()
  const field = form.createTextField('control.name')
  field.setText('Ana Mendoza')
  field.addToPage(document.getPage(0), {
    font,
    height: 24,
    width: 180,
    x: 48,
    y: 80,
  })
  form.updateFieldAppearances(font)

  return document.save({
    addDefaultPage: false,
    updateFieldAppearances: true,
    useObjectStreams: false,
  })
}

const createPdfFile = async () =>
  new File([await createControlledPdf()], 'informe final.PDF', {
    type: 'application/pdf',
  })

test('optimiza PDF estructuralmente y conserva páginas, texto y formularios', async () => {
  const file = await createPdfFile()
  const registry = new CompressionProcessorRegistry()
  registry.register(createPdfCompressionProcessor())
  const job = new CompressionJob(registry)

  const finalState = await job.start({ file })

  assert.equal(finalState.status, 'success')
  if (finalState.status !== 'success') return

  assert.equal(
    finalState.result.outputFileName,
    'informe final-comprimido.pdf',
  )
  assert.equal(finalState.result.outputMimeType, 'application/pdf')
  assert.equal(finalState.result.isSmaller, true)
  assert.deepEqual(finalState.result.metadata, {
    mode: 'structural',
    pageCount: 4,
    preservesInteractiveContent: true,
    usedOriginal: false,
    useObjectStreams: true,
  })

  const output = await PDFDocument.load(
    await finalState.result.output.arrayBuffer(),
    { updateMetadata: false },
  )
  assert.equal(output.getPageCount(), 4)
  assert.equal(output.getTitle(), 'PDF estructural de prueba')
  assert.equal(
    output.getForm().getTextField('control.name').getText(),
    'Ana Mendoza',
  )
})

test('publica progreso e inspecciona el número de páginas', async () => {
  const file = await createPdfFile()
  const processor = createPdfCompressionProcessor()
  const input = await validateCompressionFile(file)
  const progress: CompressionProgressUpdate[] = []

  const inspection = await inspectPdfFile(file)
  await processor.compress(input, {}, {
    reportProgress: (update) => progress.push(update),
    signal: new AbortController().signal,
  })

  assert.deepEqual(inspection, {
    hasDigitalSignature: false,
    pageCount: 4,
  })
  assert.deepEqual(
    progress.map(({ completed, phase, total }) => ({
      completed,
      phase,
      total,
    })),
    [
      { completed: 0, phase: 'preparing', total: 3 },
      { completed: 1, phase: 'preparing', total: 3 },
      { completed: 2, phase: 'compressing', total: 3 },
      { completed: 3, phase: 'finalizing', total: 3 },
    ],
  )
})

test('conserva el archivo original cuando la reestructuración no reduce', async () => {
  const file = await createPdfFile()
  const dependencies: PdfProcessorDependencies = {
    load: async () => ({
      hasDigitalSignature: false,
      pageCount: 4,
      save: async () => {
        const output = new Uint8Array(file.size + 100)
        output.set([0x25, 0x50, 0x44, 0x46, 0x2d])
        return output
      },
    }),
  }
  const processor = createPdfCompressionProcessor(dependencies)
  const input = await validateCompressionFile(file)

  const output = await processor.compress(input, {}, {
    reportProgress: () => undefined,
    signal: new AbortController().signal,
  })

  assert.equal(output.blob.size, file.size)
  assert.deepEqual(
    new Uint8Array(await output.blob.arrayBuffer()),
    new Uint8Array(await file.arrayBuffer()),
  )
  assert.equal(output.metadata?.usedOriginal, true)
  assert.equal(output.warnings?.length, 1)
})

test('rechaza PDFs firmados para no invalidar su firma', async () => {
  const dependencies: PdfProcessorDependencies = {
    load: async () => ({
      hasDigitalSignature: true,
      pageCount: 1,
      save: async () => new Uint8Array([1]),
    }),
  }
  const processor = createPdfCompressionProcessor(dependencies)
  const input = await validateCompressionFile(await createPdfFile())

  await assert.rejects(
    processor.compress(input, {}, {
      reportProgress: () => undefined,
      signal: new AbortController().signal,
    }),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'protected-pdf',
  )
})

test('rechaza una salida sin firma PDF válida', async () => {
  const dependencies: PdfProcessorDependencies = {
    load: async () => ({
      hasDigitalSignature: false,
      pageCount: 1,
      save: async () => new Uint8Array([1, 2, 3, 4, 5, 6]),
    }),
  }
  const processor = createPdfCompressionProcessor(dependencies)
  const input = await validateCompressionFile(await createPdfFile())

  await assert.rejects(
    processor.compress(input, {}, {
      reportProgress: () => undefined,
      signal: new AbortController().signal,
    }),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'invalid-processor-output',
  )
})

test('registra el procesador PDF una sola vez por registro', () => {
  const registry = new CompressionProcessorRegistry()
  const first = registerPdfCompressionProcessor(registry)
  const second = registerPdfCompressionProcessor(registry)

  assert.equal(first, second)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.resolve('pdf'), first)
})
