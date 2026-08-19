import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CompressionCoreError,
  CompressionJob,
  CompressionProcessorRegistry,
  validateCompressionFile,
  type CompressionProgressUpdate,
} from '../src/features/file-compression/core/index.ts'
import {
  createPngCompressionProcessor,
  registerImageCompressionProcessors,
  type PngProcessorDependencies,
} from '../src/features/file-compression/processors/index.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'

const PNG_SIGNATURE = [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
]

const createPngBytes = (size: number) =>
  Uint8Array.from([
    ...PNG_SIGNATURE,
    ...new Array(Math.max(0, size - PNG_SIGNATURE.length)).fill(1),
  ])

const createPngFile = (size = 100) =>
  new File([createPngBytes(size)], 'imagen transparente.PNG', {
    type: 'image/png',
  })

test('optimiza PNG sin pérdida con el nivel solicitado y resultado comparable', async () => {
  const received: Array<{
    level: number
    signal?: AbortSignal
    signature: number[]
  }> = []
  const dependencies: PngProcessorDependencies = {
    optimize: async (input, options, signal) => {
      received.push({
        level: options.level,
        signal,
        signature: [...new Uint8Array(input.slice(0, 8))],
      })
      return createPngBytes(30).buffer
    },
  }
  const registry = new CompressionProcessorRegistry()
  registry.register(createPngCompressionProcessor(dependencies))
  const job = new CompressionJob(registry)

  const finalState = await job.start({
    file: createPngFile(),
    options: { level: 4 },
  })

  assert.equal(finalState.status, 'success')
  assert.equal(received.length, 1)
  assert.equal(received[0]?.level, 4)
  assert.deepEqual(received[0]?.signature, PNG_SIGNATURE)

  if (finalState.status !== 'success') return
  assert.equal(
    finalState.result.outputFileName,
    'imagen transparente-comprimido.png',
  )
  assert.equal(finalState.result.outputMimeType, 'image/png')
  assert.equal(finalState.result.originalSize, 100)
  assert.equal(finalState.result.outputSize, 30)
  assert.equal(finalState.result.bytesSaved, 70)
  assert.equal(finalState.result.reductionPercentage, 70)
  assert.equal(finalState.result.isSmaller, true)
  assert.deepEqual(finalState.result.metadata, {
    level: 4,
    lossless: true,
    optimizer: 'OxiPNG WASM',
    preservesTransparency: true,
    usedOriginal: false,
  })
})

test('publica el progreso PNG y conserva el original si OxiPNG no lo reduce', async () => {
  const file = createPngFile(40)
  const levels: number[] = []
  const progress: CompressionProgressUpdate[] = []
  const processor = createPngCompressionProcessor({
    optimize: async (_input, options) => {
      levels.push(options.level)
      return createPngBytes(60).buffer
    },
  })
  const input = await validateCompressionFile(file)

  const output = await processor.compress(input, { level: 99 }, {
    reportProgress: (update) => progress.push(update),
    signal: new AbortController().signal,
  })

  assert.notEqual(output.blob, file)
  assert.equal(output.blob.size, file.size)
  assert.equal(output.blob.type, 'image/png')
  assert.deepEqual(
    new Uint8Array(await output.blob.arrayBuffer()),
    new Uint8Array(await file.arrayBuffer()),
  )
  assert.deepEqual(levels, [4])
  assert.deepEqual(output.warnings, [
    'El PNG ya estaba optimizado; se conservaron sus bytes originales.',
  ])
  assert.deepEqual(
    progress.map(({ completed, phase, total }) => ({ completed, phase, total })),
    [
      { completed: 0, phase: 'preparing', total: 3 },
      { completed: 1, phase: 'preparing', total: 3 },
      { completed: 2, phase: 'compressing', total: 3 },
      { completed: 3, phase: 'finalizing', total: 3 },
    ],
  )
})

test('rechaza una salida del optimizador que no tenga firma PNG', async () => {
  const processor = createPngCompressionProcessor({
    optimize: async () => new Uint8Array(20).buffer,
  })
  const input = await validateCompressionFile(createPngFile())

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

test('cancela la optimización PNG activa', async () => {
  const controller = new AbortController()
  let notifyStarted = () => undefined
  const started = new Promise<void>((resolve) => {
    notifyStarted = resolve
  })
  const processor = createPngCompressionProcessor({
    optimize: async (_input, _options, signal) => {
      notifyStarted()

      return new Promise((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new OperationCancelledError()),
          { once: true },
        )
      })
    },
  })
  const input = await validateCompressionFile(createPngFile())
  const processing = processor.compress(input, {}, {
    reportProgress: () => undefined,
    signal: controller.signal,
  })

  await started
  controller.abort()

  await assert.rejects(
    processing,
    (error) => error instanceof OperationCancelledError,
  )
})

test('registra JPEG y PNG una sola vez en el registro común', () => {
  const registry = new CompressionProcessorRegistry()
  const first = registerImageCompressionProcessors(registry)
  const second = registerImageCompressionProcessors(registry)

  assert.deepEqual(first, second)
  assert.equal(registry.list().length, 2)
  assert.equal(registry.resolve('jpeg'), first[0])
  assert.equal(registry.resolve('png'), first[1])
})
