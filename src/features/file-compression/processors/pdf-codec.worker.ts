import { CompressionCoreError } from '@/features/file-compression/core/errors'
import type { CompressionCoreErrorCode } from '@/features/file-compression/core/errors'
import type {
  PdfCodecOptions,
  PdfCodecResult,
} from './pdf-codec'
import { processPdfDocument } from './pdf-document'

type PdfWorkerRequest = {
  readonly input: ArrayBuffer
  readonly options: PdfCodecOptions
}

type PdfWorkerResponse =
  | { readonly result: PdfCodecResult }
  | {
      readonly error: {
        readonly code: CompressionCoreErrorCode
        readonly message: string
      }
    }

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PdfWorkerRequest>) => void) | null
  postMessage: (
    message: PdfWorkerResponse,
    transfer?: readonly Transferable[],
  ) => void
}

workerScope.onmessage = (event) => {
  void processPdfDocument(event.data.input, event.data.options).then(
    (result) => {
      const transfer = result.output ? [result.output] : undefined
      workerScope.postMessage({ result }, transfer)
    },
    (error: unknown) => {
      const normalizedError =
        error instanceof CompressionCoreError
          ? error
          : new CompressionCoreError(
              'processing-failed',
              error instanceof Error
                ? error.message
                : 'No se pudo procesar el PDF.',
            )

      workerScope.postMessage({
        error: {
          code: normalizedError.code,
          message: normalizedError.message,
        },
      })
    },
  )
}
