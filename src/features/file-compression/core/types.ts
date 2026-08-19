export type CompressionFormatDefinition = {
  readonly id: string
  readonly label: string
  readonly mimeType: string
  readonly mimeTypes: readonly string[]
  readonly extensions: readonly string[]
  readonly signatureLength: number
  readonly matchesSignature: (bytes: Uint8Array) => boolean
}

export type CompressionFileValidationWarning =
  | 'generic-mime'
  | 'missing-extension'
  | 'missing-mime'

export type ValidatedCompressionFile = {
  readonly file: File
  readonly format: CompressionFormatDefinition
  readonly detectedMimeType: string
  readonly declaredMimeType: string
  readonly extension: string
  readonly warnings: readonly CompressionFileValidationWarning[]
}

export type CompressionProgressPhase =
  | 'preparing'
  | 'compressing'
  | 'finalizing'

export type CompressionProgressUpdate = {
  readonly phase: CompressionProgressPhase
  readonly completed: number
  readonly total: number
  readonly message?: string
}

export type CompressionProgress = CompressionProgressUpdate & {
  readonly percentage: number
}

export type CompressionOptions = Readonly<Record<string, unknown>>

export type CompressionProcessorContext = {
  readonly signal: AbortSignal
  readonly reportProgress: (progress: CompressionProgressUpdate) => void
}

export type CompressionProcessorOutput = {
  readonly blob: Blob
  readonly fileName: string
  readonly warnings?: readonly string[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type CompressionProcessor = {
  readonly id: string
  readonly label: string
  readonly formatIds: readonly string[]
  readonly compress: (
    input: ValidatedCompressionFile,
    options: CompressionOptions,
    context: CompressionProcessorContext,
  ) => Promise<CompressionProcessorOutput>
}

export type CompressionResult = {
  readonly processorId: string
  readonly output: Blob
  readonly outputFileName: string
  readonly outputMimeType: string
  readonly originalSize: number
  readonly outputSize: number
  readonly bytesSaved: number
  readonly reductionPercentage: number
  readonly isSmaller: boolean
  readonly warnings: readonly string[]
  readonly metadata: Readonly<Record<string, unknown>>
}

export type CompressionJobError = {
  readonly code: string
  readonly message: string
}

export type CompressionJobState =
  | { readonly status: 'idle' }
  | { readonly status: 'validating'; readonly file: File }
  | {
      readonly status: 'ready'
      readonly input: ValidatedCompressionFile
      readonly processorId: string
    }
  | {
      readonly status: 'processing'
      readonly input: ValidatedCompressionFile
      readonly processorId: string
      readonly progress: CompressionProgress
    }
  | {
      readonly status: 'success'
      readonly input: ValidatedCompressionFile
      readonly result: CompressionResult
    }
  | {
      readonly status: 'cancelled'
      readonly input?: ValidatedCompressionFile
    }
  | {
      readonly status: 'error'
      readonly input?: ValidatedCompressionFile
      readonly error: CompressionJobError
    }

export type CompressionJobStartRequest = {
  readonly file: File
  readonly processorId?: string
  readonly options?: CompressionOptions
}

export type CompressionJobListener = (state: CompressionJobState) => void
