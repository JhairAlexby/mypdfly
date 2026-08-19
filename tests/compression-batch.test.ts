import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CompressionCoreError,
  CompressionProcessorRegistry,
  processCompressionBatch,
  type CompressionBatchProgress,
  type CompressionProcessor,
} from '../src/features/file-compression/core/index.ts'
import { OperationCancelledError } from '../src/lib/files/cancellation.ts'

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]

const createJpegFile = (name: string) =>
  new File([Uint8Array.from(JPEG_BYTES)], name, {
    type: 'image/jpeg',
  })

test('procesa el lote en secuencia y publica progreso global', async () => {
  const registry = new CompressionProcessorRegistry()
  const order: string[] = []
  const progress: CompressionBatchProgress[] = []
  let active = 0
  let maximumActive = 0
  const processor: CompressionProcessor = {
    id: 'jpeg-sequential',
    label: 'JPEG secuencial',
    formatIds: ['jpeg'],
    compress: async (input) => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      order.push(`start:${input.file.name}`)
      await new Promise((resolve) => setTimeout(resolve, 5))
      order.push(`end:${input.file.name}`)
      active -= 1
      return {
        blob: new Blob([Uint8Array.from([1])], { type: 'image/jpeg' }),
        fileName: input.file.name,
      }
    },
  }
  registry.register(processor)

  const outcomes = await processCompressionBatch(
    [
      { file: createJpegFile('uno.jpg'), id: 'one' },
      { file: createJpegFile('dos.jpg'), id: 'two' },
    ],
    { onProgress: (update) => progress.push(update) },
    registry,
  )

  assert.equal(maximumActive, 1)
  assert.deepEqual(order, [
    'start:uno.jpg',
    'end:uno.jpg',
    'start:dos.jpg',
    'end:dos.jpg',
  ])
  assert.deepEqual(outcomes.map(({ state }) => state.status), [
    'success',
    'success',
  ])
  assert.equal(progress.at(-1)?.percentage, 100)
})

test('continúa con el siguiente archivo cuando uno falla', async () => {
  const registry = new CompressionProcessorRegistry()
  registry.register({
    id: 'jpeg-partial',
    label: 'JPEG parcial',
    formatIds: ['jpeg'],
    compress: async (input) => {
      if (input.file.name === 'falla.jpg') throw new Error('fallo controlado')
      return {
        blob: new Blob([Uint8Array.from([1])], { type: 'image/jpeg' }),
        fileName: input.file.name,
      }
    },
  })

  const outcomes = await processCompressionBatch(
    [
      { file: createJpegFile('falla.jpg'), id: 'bad' },
      { file: createJpegFile('continua.jpg'), id: 'good' },
    ],
    {},
    registry,
  )

  assert.deepEqual(outcomes.map(({ state }) => state.status), [
    'error',
    'success',
  ])
})

test('cancela el archivo activo y no inicia los restantes', async () => {
  const registry = new CompressionProcessorRegistry()
  const controller = new AbortController()
  let started = 0
  registry.register({
    id: 'jpeg-cancelable-batch',
    label: 'JPEG cancelable',
    formatIds: ['jpeg'],
    compress: async (_input, _options, context) => {
      started += 1
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener(
          'abort',
          () => reject(new OperationCancelledError()),
          { once: true },
        )
        controller.abort()
      })
    },
  })

  const outcomes = await processCompressionBatch(
    [
      { file: createJpegFile('uno.jpg'), id: 'one' },
      { file: createJpegFile('dos.jpg'), id: 'two' },
    ],
    { signal: controller.signal },
    registry,
  )

  assert.equal(started, 1)
  assert.deepEqual(outcomes.map(({ state }) => state.status), [
    'cancelled',
    'cancelled',
  ])
})

test('rechaza identificadores duplicados en el lote', async () => {
  await assert.rejects(
    processCompressionBatch([
      { file: createJpegFile('uno.jpg'), id: 'same' },
      { file: createJpegFile('dos.jpg'), id: 'same' },
    ]),
    (error) =>
      error instanceof CompressionCoreError &&
      error.code === 'invalid-batch',
  )
})
