import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CompressionJob,
  CompressionProcessorRegistry,
  validateCompressionFile,
  type CompressionProgressUpdate,
} from '../src/features/file-compression/core/index.ts'
import {
  createJpegCompressionProcessor,
  inspectJpegFile,
  registerJpegCompressionProcessor,
  type DecodedJpegImage,
  type JpegProcessorDependencies,
} from '../src/features/file-compression/processors/index.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]

const createJpegFile = (size = 100) =>
  new File(
    [Uint8Array.from([...JPEG_BYTES, ...new Array(size - JPEG_BYTES.length).fill(1)])],
    'foto principal.JPG',
    { type: 'image/jpeg' },
  )

const createDecodedImage = (
  close: () => void,
): DecodedJpegImage => ({
  close,
  height: 720,
  source: {} as CanvasImageSource,
  width: 1280,
})

test('inspecciona dimensiones JPEG y libera la imagen decodificada', async () => {
  let closeCalls = 0

  const inspection = await inspectJpegFile(
    createJpegFile(),
    undefined,
    {
      decodeImage: async () =>
        createDecodedImage(() => {
          closeCalls += 1
        }),
    },
  )

  assert.deepEqual(inspection, { height: 720, width: 1280 })
  assert.equal(closeCalls, 1)
})

test('procesa un JPEG, respeta la calidad y produce un resultado comparable', async () => {
  const drawCalls: unknown[][] = []
  const encodeCalls: Array<{ quality: number; signal?: AbortSignal }> = []
  const progress: CompressionProgressUpdate[] = []
  let closeCalls = 0
  const canvas = {
    getContext: () => ({
      drawImage: (...values: unknown[]) => drawCalls.push(values),
    }),
    height: 720,
    width: 1280,
  } as unknown as HTMLCanvasElement
  const dependencies: JpegProcessorDependencies = {
    createCanvas: (width, height) => {
      assert.equal(width, 1280)
      assert.equal(height, 720)
      return canvas
    },
    decodeImage: async () =>
      createDecodedImage(() => {
        closeCalls += 1
      }),
    encode: async (_canvas, quality, options) => {
      encodeCalls.push({ quality, signal: options.signal })
      return new Blob([new Uint8Array(30)], { type: 'image/jpeg' })
    },
  }
  const registry = new CompressionProcessorRegistry()
  registry.register(createJpegCompressionProcessor(dependencies))
  const job = new CompressionJob(registry)

  const finalState = await job.start({
    file: createJpegFile(),
    options: { quality: 0.65 },
  })

  assert.equal(finalState.status, 'success')
  assert.equal(drawCalls.length, 1)
  assert.equal(encodeCalls.length, 1)
  assert.equal(encodeCalls[0]?.quality, 0.65)
  assert.equal(closeCalls, 1)
  assert.equal(canvas.width, 1)
  assert.equal(canvas.height, 1)

  if (finalState.status !== 'success') return
  assert.equal(finalState.result.outputFileName, 'foto principal-comprimido.jpg')
  assert.equal(finalState.result.originalSize, 100)
  assert.equal(finalState.result.outputSize, 30)
  assert.equal(finalState.result.bytesSaved, 70)
  assert.equal(finalState.result.reductionPercentage, 70)
  assert.equal(finalState.result.isSmaller, true)
  assert.deepEqual(finalState.result.metadata, {
    height: 720,
    quality: 0.65,
    width: 1280,
  })

  const processor = registry.resolve('jpeg')
  const input = await validateCompressionFile(createJpegFile())
  await processor.compress(input, { quality: 0.65 }, {
    reportProgress: (update) => progress.push(update),
    signal: new AbortController().signal,
  })
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

test('cancela el procesador JPEG y libera sus recursos', async () => {
  const controller = new AbortController()
  let closeCalls = 0
  let notifyEncodingStarted = () => undefined
  const encodingStarted = new Promise<void>((resolve) => {
    notifyEncodingStarted = resolve
  })
  const canvas = {
    getContext: () => ({ drawImage: () => undefined }),
    height: 720,
    width: 1280,
  } as unknown as HTMLCanvasElement
  const processor = createJpegCompressionProcessor({
    createCanvas: () => canvas,
    decodeImage: async () =>
      createDecodedImage(() => {
        closeCalls += 1
      }),
    encode: async (_canvas, _quality, options) => {
      notifyEncodingStarted()

      return new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new OperationCancelledError()),
          { once: true },
        )
      })
    },
  })
  const input = await validateCompressionFile(createJpegFile())
  const processing = processor.compress(input, {}, {
    reportProgress: () => undefined,
    signal: controller.signal,
  })

  await encodingStarted
  controller.abort()

  await assert.rejects(
    processing,
    (error) => error instanceof OperationCancelledError,
  )
  assert.equal(closeCalls, 1)
  assert.equal(canvas.width, 1)
  assert.equal(canvas.height, 1)
})

test('registra el procesador JPEG una sola vez por registro', () => {
  const registry = new CompressionProcessorRegistry()
  const first = registerJpegCompressionProcessor(registry)
  const second = registerJpegCompressionProcessor(registry)

  assert.equal(first, second)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.resolve('jpeg'), first)
})
