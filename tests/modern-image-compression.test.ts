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
  createModernImageCompressionProcessor,
  inspectModernImageFile,
  registerAvifCompressionProcessor,
  registerWebpCompressionProcessor,
  type ModernImageCodecOptions,
  type ModernImageProcessorDependencies,
} from '../src/features/file-compression/processors/index.ts'

const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46,
  0x24, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50,
] as const
const AVIF_HEADER = [
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70,
  0x61, 0x76, 0x69, 0x66,
  0x00, 0x00, 0x00, 0x00,
  0x61, 0x76, 0x69, 0x66,
] as const

const createBytes = (
  signature: readonly number[],
  size: number,
) => Uint8Array.from([
  ...signature,
  ...new Array(Math.max(0, size - signature.length)).fill(1),
])

const createModernFile = (
  format: 'avif' | 'webp',
  size = 100,
) => new File(
  [createBytes(format === 'webp' ? WEBP_HEADER : AVIF_HEADER, size)],
  `imagen moderna.${format}`,
  { type: `image/${format}` },
)

const createOutput = (format: 'avif' | 'webp', size: number) =>
  createBytes(format === 'webp' ? WEBP_HEADER : AVIF_HEADER, size).buffer

test('comprime WebP con calidad normalizada y metadatos comparables', async () => {
  const calls: ModernImageCodecOptions[] = []
  const progress: CompressionProgressUpdate[] = []
  const dependencies: ModernImageProcessorDependencies = {
    process: async (_input, options) => {
      calls.push(options)
      return {
        height: 720,
        output: createOutput('webp', 40),
        width: 1280,
      }
    },
  }
  const registry = new CompressionProcessorRegistry()
  registry.register(
    createModernImageCompressionProcessor('webp', dependencies),
  )
  const job = new CompressionJob(registry)

  const finalState = await job.start({
    file: createModernFile('webp'),
    options: { quality: 0.65 },
  })

  assert.equal(finalState.status, 'success')
  assert.deepEqual(calls, [
    { format: 'webp', mode: 'compress', quality: 65 },
  ])
  if (finalState.status !== 'success') return
  assert.equal(
    finalState.result.outputFileName,
    'imagen moderna-comprimido.webp',
  )
  assert.equal(finalState.result.outputMimeType, 'image/webp')
  assert.equal(finalState.result.outputSize, 40)
  assert.equal(finalState.result.reductionPercentage, 60)
  assert.deepEqual(finalState.result.metadata, {
    encoder: 'libwebp WASM',
    height: 720,
    preservesTransparency: true,
    quality: 65,
    usedOriginal: false,
    width: 1280,
  })

  const processor = registry.resolve('webp')
  const input = await validateCompressionFile(createModernFile('webp'))
  await processor.compress(input, { quality: 65 }, {
    reportProgress: (update) => progress.push(update),
    signal: new AbortController().signal,
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

test('inspecciona AVIF y conserva el original cuando no reduce', async () => {
  const file = createModernFile('avif', 80)
  const calls: ModernImageCodecOptions[] = []
  const dependencies: ModernImageProcessorDependencies = {
    process: async (_input, options) => {
      calls.push(options)
      return {
        height: 600,
        output:
          options.mode === 'compress'
            ? createOutput('avif', 120)
            : undefined,
        width: 800,
      }
    },
  }

  const inspection = await inspectModernImageFile(
    file,
    'avif',
    undefined,
    dependencies,
  )
  const processor = createModernImageCompressionProcessor(
    'avif',
    dependencies,
  )
  const input = await validateCompressionFile(file)
  const output = await processor.compress(input, { quality: 75 }, {
    reportProgress: () => undefined,
    signal: new AbortController().signal,
  })

  assert.deepEqual(inspection, { height: 600, width: 800 })
  assert.deepEqual(calls, [
    { format: 'avif', mode: 'inspect', quality: 80 },
    { format: 'avif', mode: 'compress', quality: 75 },
  ])
  assert.equal(output.blob.size, file.size)
  assert.equal(output.metadata?.usedOriginal, true)
  assert.equal(output.warnings?.length, 2)
})

test('rechaza WebP animado antes de perder fotogramas', async () => {
  const animatedBytes = Uint8Array.from([
    ...WEBP_HEADER,
    0x41, 0x4e, 0x49, 0x4d,
    0x00, 0x00, 0x00, 0x00,
  ])
  const file = new File([animatedBytes], 'animacion.webp', {
    type: 'image/webp',
  })
  const dependencies: ModernImageProcessorDependencies = {
    process: async () => ({ height: 1, width: 1 }),
  }

  await assert.rejects(
    inspectModernImageFile(file, 'webp', undefined, dependencies),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'unsupported-format',
  )
})

test('rechaza secuencias AVIF pero no confunde datos posteriores con la marca', async () => {
  const sequenceHeader = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70,
    0x61, 0x76, 0x69, 0x73,
    0x00, 0x00, 0x00, 0x00,
    0x61, 0x76, 0x69, 0x66,
    0x00, 0x00, 0x00, 0x00,
  ])
  const staticWithAvisPayload = Uint8Array.from([
    ...AVIF_HEADER,
    0x00, 0x00, 0x00, 0x00,
    0x61, 0x76, 0x69, 0x73,
  ])
  const dependencies: ModernImageProcessorDependencies = {
    process: async () => ({ height: 90, width: 160 }),
  }

  await assert.rejects(
    inspectModernImageFile(
      new File([sequenceHeader], 'secuencia.avif', {
        type: 'image/avif',
      }),
      'avif',
      undefined,
      dependencies,
    ),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'unsupported-format',
  )
  assert.deepEqual(
    await inspectModernImageFile(
      new File([staticWithAvisPayload], 'estatica.avif', {
        type: 'image/avif',
      }),
      'avif',
      undefined,
      dependencies,
    ),
    { height: 90, width: 160 },
  )
})

test('rechaza una salida que no corresponda al formato moderno', async () => {
  const processor = createModernImageCompressionProcessor('webp', {
    process: async () => ({
      height: 1,
      output: new Uint8Array(40).buffer,
      width: 1,
    }),
  })
  const input = await validateCompressionFile(createModernFile('webp'))

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

test('registra WebP y AVIF una sola vez por registro', () => {
  const registry = new CompressionProcessorRegistry()
  const webp = registerWebpCompressionProcessor(registry)
  const avif = registerAvifCompressionProcessor(registry)

  assert.equal(registerWebpCompressionProcessor(registry), webp)
  assert.equal(registerAvifCompressionProcessor(registry), avif)
  assert.equal(registry.list().length, 2)
  assert.equal(registry.resolve('webp'), webp)
  assert.equal(registry.resolve('avif'), avif)
})
