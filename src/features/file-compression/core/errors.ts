export type CompressionCoreErrorCode =
  | 'duplicate-processor'
  | 'empty-file'
  | 'extension-signature-mismatch'
  | 'invalid-processor'
  | 'invalid-processor-output'
  | 'job-active'
  | 'mime-signature-mismatch'
  | 'processing-failed'
  | 'processor-incompatible'
  | 'processor-not-found'
  | 'unsupported-format'
  | 'unsupported-signature'

export class CompressionCoreError extends Error {
  readonly code: CompressionCoreErrorCode

  constructor(code: CompressionCoreErrorCode, message: string) {
    super(message)
    this.name = 'CompressionCoreError'
    this.code = code
  }
}
