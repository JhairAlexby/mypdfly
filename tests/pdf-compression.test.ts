import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  PDFDocument,
  PDFHexString,
  PDFName,
  StandardFonts,
} from 'pdf-lib'

import {
  CompressionCoreError,
  CompressionJob,
  CompressionProcessorRegistry,
  MAXIMUM_PDF_FILE_SIZE_BYTES,
  validateCompressionFile,
  type CompressionProgressUpdate,
} from '../src/features/file-compression/core/index.ts'
import {
  createPdfCompressionProcessor,
  inspectPdfFile,
  registerPdfCompressionProcessor,
  type PdfProcessorDependencies,
} from '../src/features/file-compression/processors/index.ts'
import { processPdfInWorker } from '../src/features/file-compression/processors/pdf-codec.ts'
import { processPdfDocument } from '../src/features/file-compression/processors/pdf-document.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'

const directPdfDependencies: PdfProcessorDependencies = {
  process: (input, options) => processPdfDocument(input, options),
}

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

const createSignatureFieldPdf = async (signed: boolean) => {
  const document = await PDFDocument.create({ updateMetadata: false })
  document.addPage([200, 200])
  const field = document.context.obj({
    FT: 'Sig',
    T: PDFHexString.fromText('approval'),
  })

  if (signed) {
    const signatureValue = document.context.obj({
      ByteRange: [0, 1, 2, 1],
      Contents: PDFHexString.of('AABB'),
      Type: 'Sig',
    })
    field.set(
      PDFName.of('V'),
      document.context.register(signatureValue),
    )
  }

  const fieldReference = document.context.register(field)
  const acroForm = document.context.obj({ Fields: [fieldReference] })
  document.catalog.set(
    PDFName.of('AcroForm'),
    document.context.register(acroForm),
  )

  return new File(
    [await document.save({ useObjectStreams: false })],
    signed ? 'firmado.pdf' : 'firma-vacia.pdf',
    { type: 'application/pdf' },
  )
}

test('optimiza PDF estructuralmente y conserva páginas, texto y formularios', async () => {
  const file = await createPdfFile()
  const registry = new CompressionProcessorRegistry()
  registry.register(createPdfCompressionProcessor(directPdfDependencies))
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
  const processor = createPdfCompressionProcessor(directPdfDependencies)
  const input = await validateCompressionFile(file)
  const progress: CompressionProgressUpdate[] = []

  const inspection = await inspectPdfFile(
    file,
    undefined,
    directPdfDependencies,
  )
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
    process: async () => ({
      hasDigitalSignature: false,
      output: (() => {
        const output = new Uint8Array(file.size + 100)
        output.set([0x25, 0x50, 0x44, 0x46, 0x2d])
        return output.buffer
      })(),
      pageCount: 4,
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
    process: async () => ({
      hasDigitalSignature: true,
      pageCount: 1,
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
    process: async () => ({
      hasDigitalSignature: false,
      output: Uint8Array.from([1, 2, 3, 4, 5, 6]).buffer,
      pageCount: 1,
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

test('permite un campo de firma vacío y detecta uno firmado', async () => {
  const emptySignatureFile = await createSignatureFieldPdf(false)
  const signedFile = await createSignatureFieldPdf(true)

  assert.deepEqual(
    await inspectPdfFile(
      emptySignatureFile,
      undefined,
      directPdfDependencies,
    ),
    {
      hasDigitalSignature: false,
      pageCount: 1,
    },
  )
  await assert.rejects(
    inspectPdfFile(signedFile, undefined, directPdfDependencies),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'protected-pdf',
  )
})

test('aplica el límite PDF antes de invocar al parser', async () => {
  const file = await createPdfFile()
  let parserWasCalled = false
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: MAXIMUM_PDF_FILE_SIZE_BYTES + 1,
  })

  await assert.rejects(
    inspectPdfFile(file, undefined, {
      process: async () => {
        parserWasCalled = true
        return { hasDigitalSignature: false, pageCount: 1 }
      },
    }),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'file-too-large',
  )
  assert.equal(parserWasCalled, false)
})

test('aplica el límite PDF también antes de comprimir', async () => {
  const file = await createPdfFile()
  const input = await validateCompressionFile(file)
  let parserWasCalled = false
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: MAXIMUM_PDF_FILE_SIZE_BYTES + 1,
  })
  const processor = createPdfCompressionProcessor({
    process: async () => {
      parserWasCalled = true
      return { hasDigitalSignature: false, pageCount: 1 }
    },
  })

  await assert.rejects(
    processor.compress(input, {}, {
      reportProgress: () => undefined,
      signal: new AbortController().signal,
    }),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'file-too-large',
  )
  assert.equal(parserWasCalled, false)
})

test('termina el worker PDF cuando se cancela la operación', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker')
  let postedMessages = 0
  let terminatedWorkers = 0

  class PdfWorkerStub extends EventTarget {
    postMessage() {
      postedMessages += 1
    }

    terminate() {
      terminatedWorkers += 1
    }
  }

  Object.defineProperty(globalThis, 'Worker', {
    configurable: true,
    value: PdfWorkerStub,
  })

  try {
    const controller = new AbortController()
    const processing = processPdfInWorker(
      new ArrayBuffer(16),
      { mode: 'compress' },
      controller.signal,
    )
    controller.abort()

    await assert.rejects(
      processing,
      (error) => error instanceof OperationCancelledError,
    )
    assert.equal(postedMessages, 1)
    assert.equal(terminatedWorkers, 1)
  } finally {
    if (originalWorker) {
      Object.defineProperty(globalThis, 'Worker', originalWorker)
    } else {
      Reflect.deleteProperty(globalThis, 'Worker')
    }
  }
})

test('registra el procesador PDF una sola vez por registro', () => {
  const registry = new CompressionProcessorRegistry()
  const first = registerPdfCompressionProcessor(registry)
  const second = registerPdfCompressionProcessor(registry)

  assert.equal(first, second)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.resolve('pdf'), first)
})
