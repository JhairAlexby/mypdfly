import assert from 'node:assert/strict'
import { test } from 'node:test'

import type {
  ScannerProcessResult,
  ScannerWorkerResponse,
} from '../experiments/image-scanner/types.ts'
import {
  ImageScannerWorkerClient,
  ScannerCancelledError,
  type ScannerWorkerLike,
} from '../experiments/image-scanner/worker-client.ts'

const createInput = () => ({
  height: 1,
  pixels: new Uint8ClampedArray([255, 255, 255, 255]).buffer,
  width: 1,
})

const successfulResult: ScannerProcessResult = {
  detection: {
    confidence: 1,
    corners: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    detected: true,
  },
  filter: 'document-clean',
  height: 1,
  metrics: {
    detectMs: 1,
    filterMs: 1,
    inputPixels: 1,
    opencvLoadMs: 1,
    opencvVersion: '5.0.0',
    perspectiveMs: 1,
    totalMs: 4,
    wasmHeapAfterBytes: 1024,
    wasmHeapBeforeBytes: 1024,
  },
  output: new Uint8ClampedArray([255, 255, 255, 255]).buffer,
  outputStats: { blackPixelRatio: 0, whitePixelRatio: 1 },
  perspectiveApplied: true,
  width: 1,
}

class WorkerStub extends EventTarget {
  lastRequestId: number | null = null
  terminated = false

  postMessage(message: { requestId: number }) {
    this.lastRequestId = message.requestId
  }

  terminate() {
    this.terminated = true
  }

  emit(response: ScannerWorkerResponse) {
    this.dispatchEvent(new MessageEvent('message', { data: response }))
  }
}

test('termina el worker al cancelar y permite procesar con uno nuevo', async () => {
  const workers: WorkerStub[] = []
  const client = new ImageScannerWorkerClient(() => {
    const worker = new WorkerStub()
    workers.push(worker)
    return worker as unknown as ScannerWorkerLike
  })
  const controller = new AbortController()
  const stages: string[] = []
  const processing = client.process(
    createInput(),
    { filter: 'document-clean' },
    {
      onStage: (stage) => stages.push(stage),
      signal: controller.signal,
    },
  )

  workers[0].emit({
    requestId: workers[0].lastRequestId ?? -1,
    stage: 'filtering',
    type: 'stage',
  })
  controller.abort()

  await assert.rejects(
    processing,
    (error) => error instanceof ScannerCancelledError,
  )
  assert.deepEqual(stages, ['filtering'])
  assert.equal(workers[0].terminated, true)

  const recovery = client.process(createInput(), {
    filter: 'document-clean',
  })
  assert.equal(workers.length, 2)
  workers[1].emit({
    requestId: workers[1].lastRequestId ?? -1,
    result: successfulResult,
    type: 'success',
  })

  assert.equal(await recovery, successfulResult)
  assert.equal(client.isActive, false)
  client.dispose()
  assert.equal(workers[1].terminated, true)
})

test('rechaza entradas RGBA incompletas antes de crear un worker', () => {
  let workerCreations = 0
  const client = new ImageScannerWorkerClient(() => {
    workerCreations += 1
    return new WorkerStub() as unknown as ScannerWorkerLike
  })

  assert.throws(
    () => client.process(
      { height: 2, pixels: new ArrayBuffer(4), width: 2 },
      { filter: 'document-clean' },
    ),
    /entrada RGBA.*dimensiones válidas/,
  )
  assert.equal(workerCreations, 0)
})

test('impide iniciar dos procesamientos concurrentes', async () => {
  const worker = new WorkerStub()
  const client = new ImageScannerWorkerClient(
    () => worker as unknown as ScannerWorkerLike,
  )
  const first = client.process(createInput(), { filter: 'document-clean' })

  await assert.rejects(
    client.process(createInput(), { filter: 'document-clean' }),
    /procesamiento de imagen activo/,
  )
  client.cancel()
  await assert.rejects(first, ScannerCancelledError)
})
