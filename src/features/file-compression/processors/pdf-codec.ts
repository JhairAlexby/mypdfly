import {
  CompressionCoreError,
  type CompressionCoreErrorCode,
} from '@/features/file-compression/core'
import {
  OperationCancelledError,
  throwIfAborted,
} from '@/lib/files'

export type PdfCodecOptions = {
  readonly mode: 'compress' | 'inspect'
}

export type PdfCodecResult = {
  readonly hasDigitalSignature: boolean
  readonly output?: ArrayBuffer
  readonly pageCount: number
}

export type PdfCodec = (
  input: ArrayBuffer,
  options: PdfCodecOptions,
  signal?: AbortSignal,
) => Promise<PdfCodecResult>

type PdfWorkerResponse =
  | { readonly result: PdfCodecResult }
  | {
      readonly error: {
        readonly code: CompressionCoreErrorCode
        readonly message: string
      }
    }

const createPdfWorker = () =>
  new Worker(new URL('./pdf-codec.worker.ts', import.meta.url), {
    name: 'mypdfly-pdf-codec',
    type: 'module',
  })

export const processPdfInWorker: PdfCodec = (
  input,
  options,
  signal,
) => {
  throwIfAborted(signal)

  return new Promise<PdfCodecResult>((resolve, reject) => {
    const worker = createPdfWorker()
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
      (event: MessageEvent<PdfWorkerResponse>) => {
        const response = event.data

        if ('error' in response) {
          finish(() =>
            reject(
              new CompressionCoreError(
                response.error.code,
                response.error.message,
              ),
            ),
          )
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
            new CompressionCoreError(
              'processing-failed',
              event.message || 'No se pudo iniciar el procesador PDF.',
            ),
          ),
        ),
      { once: true },
    )
    signal?.addEventListener('abort', onAbort, { once: true })
    worker.postMessage({ input, options }, [input])
  })
}
