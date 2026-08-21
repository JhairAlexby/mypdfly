import {
  OperationCancelledError,
  throwIfAborted,
} from '@/lib/files'

export type ModernImageFormat = 'avif' | 'webp'

export type ModernImageCodecOptions = {
  readonly format: ModernImageFormat
  readonly mode: 'compress' | 'decode' | 'inspect'
  readonly quality: number
}

export type ModernImageCodecResult = {
  readonly height: number
  readonly output?: ArrayBuffer
  readonly pixels?: ArrayBuffer
  readonly width: number
}

export type ModernImageCodec = (
  input: ArrayBuffer,
  options: ModernImageCodecOptions,
  signal?: AbortSignal,
) => Promise<ModernImageCodecResult>

type ModernImageWorkerResponse =
  | { readonly result: ModernImageCodecResult }
  | { readonly error: string }

const createModernImageWorker = () =>
  new Worker(new URL('./modern-image-codec.worker.ts', import.meta.url), {
    name: 'mypdfly-modern-image-codec',
    type: 'module',
  })

export const processModernImageInWorker: ModernImageCodec = (
  input,
  options,
  signal,
) => {
  throwIfAborted(signal)

  return new Promise<ModernImageCodecResult>((resolve, reject) => {
    const worker = createModernImageWorker()
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
      (event: MessageEvent<ModernImageWorkerResponse>) => {
        const response = event.data

        if ('error' in response) {
          finish(() => reject(new Error(response.error)))
          return
        }

        finish(() => resolve(response.result))
      },
      { once: true },
    )
    worker.addEventListener(
      'error',
      (event) =>
        finish(() =>
          reject(
            new Error(
              event.message ||
                'No se pudo iniciar el codificador de imagen.',
            ),
          ),
        ),
      { once: true },
    )
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.postMessage({ input, options }, [input])
  })
}
