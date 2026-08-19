export type CompressionCoreErrorCode =
  | 'duplicate-processor'
  | 'empty-file'
  | 'extension-signature-mismatch'
  | 'file-too-large'
  | 'invalid-pdf'
  | 'invalid-batch'
  | 'invalid-processor'
  | 'invalid-processor-output'
  | 'job-active'
  | 'mime-signature-mismatch'
  | 'processing-failed'
  | 'protected-pdf'
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
