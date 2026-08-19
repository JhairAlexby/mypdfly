import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CompressionCoreError,
  CompressionJob,
  CompressionProcessorRegistry,
  MAXIMUM_PDF_FILE_SIZE_BYTES,
  validateCompressionFile,
  type CompressionProcessor,
  type CompressionJobState,
} from '../src/features/file-compression/core/index.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'
import {
  getFileExtension,
  getSafeFileBaseName,
  sanitizeFileNamePart,
} from '../src/lib/files/file-names.ts'

const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]
const PNG_BYTES = [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
  0x00,
]
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]
const WEBP_BYTES = [
  0x52, 0x49, 0x46, 0x46,
  0x10, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
  0x56, 0x50, 0x38, 0x20,
]
const AVIF_BYTES = [
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x61, 0x76, 0x69, 0x66,
  0x00, 0x00, 0x00, 0x00,
  0x61, 0x76, 0x69, 0x66,
]

const createFile = (
  bytes: readonly number[],
  name: string,
  type: string,
) => new File([Uint8Array.from(bytes)], name, { type })

const getErrorCode = (error: unknown) =>
  error instanceof CompressionCoreError ? error.code : undefined

test('detecta PDF, PNG y JPEG mediante su firma binaria', async () => {
  const [pdf, png, jpeg] = await Promise.all([
    validateCompressionFile(
      createFile(PDF_BYTES, 'documento.pdf', 'application/pdf'),
    ),
    validateCompressionFile(createFile(PNG_BYTES, 'imagen.png', 'image/png')),
    validateCompressionFile(createFile(JPEG_BYTES, 'foto.jpg', 'image/jpeg')),
  ])

  assert.equal(pdf.format.id, 'pdf')
  assert.equal(pdf.detectedMimeType, 'application/pdf')
  assert.equal(png.format.id, 'png')
  assert.equal(png.detectedMimeType, 'image/png')
  assert.equal(jpeg.format.id, 'jpeg')
  assert.equal(jpeg.detectedMimeType, 'image/jpeg')
})

test('detecta WebP y AVIF mediante contenedor y marca interna', async () => {
  const [webp, avif] = await Promise.all([
    validateCompressionFile(
      createFile(WEBP_BYTES, 'imagen.webp', 'image/webp'),
    ),
    validateCompressionFile(
      createFile(AVIF_BYTES, 'imagen.avif', 'image/avif'),
    ),
  ])

  assert.equal(webp.format.id, 'webp')
  assert.equal(webp.detectedMimeType, 'image/webp')
  assert.equal(avif.format.id, 'avif')
  assert.equal(avif.detectedMimeType, 'image/avif')
})

test('acepta MIME genérico si la firma y extensión son válidas', async () => {
  const file = createFile(
    JPEG_BYTES,
    'fotografia.jpeg',
    'application/octet-stream',
  )
  const validated = await validateCompressionFile(file)

  assert.equal(validated.format.id, 'jpeg')
  assert.deepEqual(validated.warnings, ['generic-mime'])
})

test('acepta archivos sin MIME o extensión y registra advertencias', async () => {
  const validated = await validateCompressionFile(
    createFile(PNG_BYTES, 'imagen', ''),
  )

  assert.equal(validated.format.id, 'png')
  assert.deepEqual(validated.warnings, [
    'missing-mime',
    'missing-extension',
  ])
})

test('rechaza inconsistencias entre MIME, extensión y firma', async () => {
  await assert.rejects(
    validateCompressionFile(createFile(PNG_BYTES, 'imagen.png', 'image/jpeg')),
    (error) => getErrorCode(error) === 'mime-signature-mismatch',
  )
  await assert.rejects(
    validateCompressionFile(createFile(PNG_BYTES, 'imagen.jpg', 'image/png')),
    (error) => getErrorCode(error) === 'extension-signature-mismatch',
  )
})

test('rechaza archivos vacíos o con una firma desconocida', async () => {
  await assert.rejects(
    validateCompressionFile(createFile([], 'vacio.pdf', 'application/pdf')),
    (error) => getErrorCode(error) === 'empty-file',
  )
  await assert.rejects(
    validateCompressionFile(
      createFile([0x00, 0x01, 0x02], 'desconocido.pdf', 'application/pdf'),
    ),
    (error) => getErrorCode(error) === 'unsupported-signature',
  )
})

test('rechaza un PDF sobre el límite seguro antes de procesarlo', async () => {
  const file = createFile(PDF_BYTES, 'demasiado-grande.pdf', 'application/pdf')
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: MAXIMUM_PDF_FILE_SIZE_BYTES + 1,
  })

  await assert.rejects(
    validateCompressionFile(file),
    (error) => getErrorCode(error) === 'file-too-large',
  )
})

test('registra, resuelve y elimina procesadores por formato', () => {
  const registry = new CompressionProcessorRegistry()
  const processor: CompressionProcessor = {
    compress: async () => ({
      blob: new Blob([Uint8Array.from([1])], { type: 'image/jpeg' }),
      fileName: 'salida.jpg',
    }),
    formatIds: ['jpeg'],
    id: 'jpeg-prueba',
    label: 'JPEG de prueba',
  }

  registry.register(processor)

  assert.equal(registry.get('jpeg-prueba'), processor)
  assert.deepEqual(registry.findCompatible('jpeg'), [processor])
  assert.equal(registry.resolve('jpeg'), processor)
  assert.equal(registry.resolve('jpeg', 'jpeg-prueba'), processor)
  assert.equal(registry.unregister('jpeg-prueba'), true)
  assert.equal(registry.get('jpeg-prueba'), undefined)
})

test('impide procesadores duplicados, inválidos o incompatibles', () => {
  const registry = new CompressionProcessorRegistry()
  const processor: CompressionProcessor = {
    compress: async () => ({
      blob: new Blob([Uint8Array.from([1])], { type: 'image/png' }),
      fileName: 'salida.png',
    }),
    formatIds: ['png'],
    id: 'png-prueba',
    label: 'PNG de prueba',
  }

  registry.register(processor)

  assert.throws(
    () => registry.register(processor),
    (error) => getErrorCode(error) === 'duplicate-processor',
  )
  assert.throws(
    () => registry.resolve('jpeg', 'png-prueba'),
    (error) => getErrorCode(error) === 'processor-incompatible',
  )
  assert.throws(
    () =>
      registry.register({
        ...processor,
        formatIds: ['formato-futuro'],
        id: 'formato-desconocido',
      }),
    (error) => getErrorCode(error) === 'unsupported-format',
  )
})

test('publica estados, progreso normalizado y resultado comparable', async () => {
  const registry = new CompressionProcessorRegistry()
  const receivedOptions: Array<Record<string, unknown>> = []
  let reportLateProgress = () => undefined
  const processor: CompressionProcessor = {
    compress: async (_input, options, context) => {
      receivedOptions.push(options)
      context.reportProgress({
        completed: 1,
        message: 'Comprimiendo archivo…',
        phase: 'compressing',
        total: 4,
      })
      context.reportProgress({
        completed: 9,
        phase: 'finalizing',
        total: 4,
      })
      reportLateProgress = () =>
        context.reportProgress({
          completed: 1,
          phase: 'compressing',
          total: 10,
        })

      return {
        blob: new Blob([Uint8Array.from([1, 2, 3, 4])], {
          type: 'image/jpeg',
        }),
        fileName: 'foto-comprimida.jpg',
        metadata: { quality: 0.7 },
        warnings: ['processor-warning'],
      }
    },
    formatIds: ['jpeg'],
    id: 'jpeg-prueba',
    label: 'JPEG de prueba',
  }
  registry.register(processor)

  const file = createFile(
    [...JPEG_BYTES, 1, 2, 3, 4, 5, 6, 7, 8],
    'foto.jpg',
    'image/jpeg',
  )
  const job = new CompressionJob(registry)
  const states: CompressionJobState[] = []
  job.subscribe((state) => states.push(state))

  const finalState = await job.start({
    file,
    options: { quality: 0.7 },
  })

  assert.equal(finalState.status, 'success')
  assert.equal(job.isActive, false)
  reportLateProgress()
  assert.equal(job.state.status, 'success')
  assert.deepEqual(receivedOptions, [{ quality: 0.7 }])
  assert.deepEqual(
    states.map((state) => state.status),
    [
      'idle',
      'validating',
      'ready',
      'processing',
      'processing',
      'processing',
      'success',
    ],
  )

  const progressStates = states.filter(
    (state): state is Extract<CompressionJobState, { status: 'processing' }> =>
      state.status === 'processing',
  )
  assert.equal(progressStates[1].progress.percentage, 25)
  assert.equal(progressStates[2].progress.percentage, 100)

  if (finalState.status !== 'success') return
  assert.equal(finalState.result.processorId, 'jpeg-prueba')
  assert.equal(finalState.result.outputFileName, 'foto-comprimida.jpg')
  assert.equal(finalState.result.outputSize, 4)
  assert.equal(finalState.result.bytesSaved, file.size - 4)
  assert.equal(finalState.result.isSmaller, true)
  assert.deepEqual(finalState.result.warnings, ['processor-warning'])
  assert.deepEqual(finalState.result.metadata, { quality: 0.7 })
})

test('cancela un trabajo activo y conserva un estado terminal estable', async () => {
  const registry = new CompressionProcessorRegistry()
  let notifyStarted = () => undefined
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve
  })
  const processor: CompressionProcessor = {
    compress: async (_input, _options, context) => {
      notifyStarted()

      return new Promise((_resolve, reject) => {
        context.signal.addEventListener(
          'abort',
          () => reject(new OperationCancelledError()),
          { once: true },
        )
      })
    },
    formatIds: ['jpeg'],
    id: 'jpeg-cancelable',
    label: 'JPEG cancelable',
  }
  registry.register(processor)

  const job = new CompressionJob(registry)
  const running = job.start({
    file: createFile(JPEG_BYTES, 'foto.jpg', 'image/jpeg'),
  })
  await started

  assert.equal(job.isActive, true)
  assert.equal(job.cancel(), true)

  const finalState = await running
  assert.equal(finalState.status, 'cancelled')
  assert.equal(job.state.status, 'cancelled')
  assert.equal(job.isActive, false)
  assert.equal(job.cancel(), false)

  job.reset()
  assert.equal(job.state.status, 'idle')
})

test('no permite iniciar otro trabajo mientras el procesador cancelado sigue activo', async () => {
  const registry = new CompressionProcessorRegistry()
  let releaseProcessor = () => undefined
  let notifyStarted = () => undefined
  let executionCount = 0
  const processorReleased = new Promise<void>((resolve) => {
    releaseProcessor = resolve
  })
  const processorStarted = new Promise<void>((resolve) => {
    notifyStarted = resolve
  })
  const processor: CompressionProcessor = {
    compress: async () => {
      executionCount += 1
      if (executionCount === 1) {
        notifyStarted()
        await processorReleased
      }

      return {
        blob: new Blob([Uint8Array.from([1])], { type: 'image/jpeg' }),
        fileName: 'salida.jpg',
      }
    },
    formatIds: ['jpeg'],
    id: 'jpeg-lento',
    label: 'JPEG lento',
  }
  registry.register(processor)

  const job = new CompressionJob(registry)
  const firstRun = job.start({
    file: createFile(JPEG_BYTES, 'primero.jpg', 'image/jpeg'),
  })
  await processorStarted

  assert.equal(job.cancel(), true)
  assert.equal(job.isActive, true)
  assert.equal(job.state.status, 'processing')
  await assert.rejects(
    job.start({
      file: createFile(JPEG_BYTES, 'segundo.jpg', 'image/jpeg'),
    }),
    (error) => getErrorCode(error) === 'job-active',
  )

  releaseProcessor()
  const cancelledState = await firstRun
  assert.equal(cancelledState.status, 'cancelled')
  assert.equal(job.isActive, false)

  const secondRun = await job.start({
    file: createFile(JPEG_BYTES, 'segundo.jpg', 'image/jpeg'),
  })
  assert.equal(secondRun.status, 'success')
})

test('convierte errores de validación o falta de procesador en estado error', async () => {
  const registry = new CompressionProcessorRegistry()
  const job = new CompressionJob(registry)

  const unsupported = await job.start({
    file: createFile([0x00, 0x01], 'archivo.jpg', 'image/jpeg'),
  })
  assert.equal(unsupported.status, 'error')
  if (unsupported.status === 'error') {
    assert.equal(unsupported.error.code, 'unsupported-signature')
  }

  const noProcessor = await job.start({
    file: createFile(JPEG_BYTES, 'foto.jpg', 'image/jpeg'),
  })
  assert.equal(noProcessor.status, 'error')
  if (noProcessor.status === 'error') {
    assert.equal(noProcessor.error.code, 'processor-not-found')
  }
})

test('normaliza nombres y extensiones sin depender del formato', () => {
  assert.equal(getFileExtension('Foto.Final.JPEG'), 'jpeg')
  assert.equal(getFileExtension('sin-extension'), '')
  assert.equal(sanitizeFileNamePart('  foto:* principal  '), 'foto- principal')
  assert.equal(getSafeFileBaseName('  foto final.JPG  '), 'foto final')
  assert.equal(getSafeFileBaseName('.gitignore'), '.gitignore')
})
