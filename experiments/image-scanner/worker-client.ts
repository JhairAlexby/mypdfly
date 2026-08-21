import type {
  ScannerInput,
  ScannerProcessOptions,
  ScannerProcessResult,
  ScannerWorkerResponse,
  ScannerWorkerStage,
} from './types'

export class ScannerCancelledError extends Error {
  constructor() {
    super('El procesamiento del escáner fue cancelado.')
    this.name = 'ScannerCancelledError'
  }
}

export type ScannerWorkerLike = Pick<
  Worker,
  'addEventListener' | 'postMessage' | 'removeEventListener' | 'terminate'
>

export type ScannerWorkerFactory = () => ScannerWorkerLike

export type ScannerProcessControls = {
  readonly onStage?: (stage: ScannerWorkerStage) => void
  readonly signal?: AbortSignal
}

type ActiveRequest = {
  readonly controls: ScannerProcessControls
  readonly reject: (error: unknown) => void
  readonly requestId: number
  readonly resolve: (result: ScannerProcessResult) => void
}

const createBrowserWorker: ScannerWorkerFactory = () =>
  new Worker(new URL('./opencv.worker.ts', import.meta.url), {
    name: 'mypdfly-image-scanner-spike',
    type: 'module',
  })

const assertValidInput = ({ height, pixels, width }: ScannerInput) => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    pixels.byteLength !== width * height * 4
  ) {
    throw new Error('La entrada RGBA del escáner no tiene dimensiones válidas.')
  }
}

export class ImageScannerWorkerClient {
  readonly #workerFactory: ScannerWorkerFactory
  #active: ActiveRequest | null = null
  #nextRequestId = 1
  #worker: ScannerWorkerLike | null = null

  constructor(workerFactory: ScannerWorkerFactory = createBrowserWorker) {
    this.#workerFactory = workerFactory
  }

  get isActive() {
    return this.#active !== null
  }

  process(
    input: ScannerInput,
    options: ScannerProcessOptions,
    controls: ScannerProcessControls = {},
  ) {
    assertValidInput(input)
    if (this.#active) {
      return Promise.reject(
        new Error('Ya existe un procesamiento de imagen activo.'),
      )
    }
    if (controls.signal?.aborted) {
      return Promise.reject(new ScannerCancelledError())
    }

    const worker = this.#getWorker()
    const requestId = this.#nextRequestId
    this.#nextRequestId += 1

    return new Promise<ScannerProcessResult>((resolve, reject) => {
      this.#active = { controls, reject, requestId, resolve }
      controls.signal?.addEventListener('abort', this.#handleAbort, {
        once: true,
      })

      worker.postMessage(
        {
          input,
          options,
          requestId,
          type: 'process',
        },
        [input.pixels],
      )
    })
  }

  cancel() {
    if (!this.#active) return false
    this.#cancelActive()
    return true
  }

  dispose() {
    if (this.#active) this.#cancelActive()
    this.#terminateWorker()
  }

  readonly #handleAbort = () => {
    if (this.#active) this.#cancelActive()
  }

  readonly #handleMessage = (event: MessageEvent<ScannerWorkerResponse>) => {
    const active = this.#active
    const response = event.data
    if (!active || response.requestId !== active.requestId) return

    if (response.type === 'stage') {
      active.controls.onStage?.(response.stage)
      return
    }

    this.#clearActive()
    if (response.type === 'success') {
      active.resolve(response.result)
      return
    }

    active.reject(new Error(response.error))
  }

  readonly #handleWorkerError = (event: ErrorEvent) => {
    const active = this.#active
    if (!active) return

    this.#clearActive()
    this.#terminateWorker()
    active.reject(
      new Error(event.message || 'El worker local de OpenCV dejó de responder.'),
    )
  }

  #getWorker() {
    if (this.#worker) return this.#worker

    const worker = this.#workerFactory()
    worker.addEventListener('message', this.#handleMessage)
    worker.addEventListener('error', this.#handleWorkerError)
    this.#worker = worker
    return worker
  }

  #cancelActive() {
    const active = this.#active
    if (!active) return

    this.#clearActive()
    this.#terminateWorker()
    active.reject(new ScannerCancelledError())
  }

  #clearActive() {
    const active = this.#active
    active?.controls.signal?.removeEventListener('abort', this.#handleAbort)
    this.#active = null
  }

  #terminateWorker() {
    if (!this.#worker) return

    this.#worker.removeEventListener('message', this.#handleMessage)
    this.#worker.removeEventListener('error', this.#handleWorkerError)
    this.#worker.terminate()
    this.#worker = null
  }
}
