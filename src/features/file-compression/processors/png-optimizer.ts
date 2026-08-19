import {
  OperationCancelledError,
  throwIfAborted,
} from '@/lib/files'

export type PngOptimiseOptions = {
  readonly level: number
}

export type PngOptimizer = (
  input: ArrayBuffer,
  options: PngOptimiseOptions,
  signal?: AbortSignal,
) => Promise<ArrayBuffer>

type PngWorkerResponse =
  | { readonly output: ArrayBuffer }
  | { readonly error: string }

const createPngOptimizerWorker = () =>
  new Worker(new URL('./png-optimizer.worker.ts', import.meta.url), {
    name: 'mypdfly-png-optimizer',
    type: 'module',
  })

export const optimizePngInWorker: PngOptimizer = (
  input,
  options,
  signal,
) => {
  throwIfAborted(signal)

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = createPngOptimizerWorker()
    let settled = false

    const cleanup = () => {
      signal?.removeEventListener('abort', onAbort)
      worker.terminate()
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onAbort = () =>
      finish(() => reject(new OperationCancelledError()))

    worker.addEventListener(
      'message',
      (event: MessageEvent<PngWorkerResponse>) => {
        const response = event.data

        if ('error' in response) {
          finish(() => reject(new Error(response.error)))
          return
        }

        finish(() => resolve(response.output))
      },
      { once: true },
    )
    worker.addEventListener(
      'error',
      (event) =>
        finish(() =>
          reject(
            new Error(
              event.message || 'No se pudo iniciar el optimizador PNG.',
            ),
          ),
        ),
      { once: true },
    )
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.postMessage({ input, level: options.level }, [input])
  })
}
