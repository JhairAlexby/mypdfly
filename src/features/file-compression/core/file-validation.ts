import { getFileExtension } from '@/lib/files/file-names'
import { CompressionCoreError } from './errors'
import {
  DEFAULT_COMPRESSION_FORMATS,
  findFormatByExtension,
  findFormatByMimeType,
  getMaximumSignatureLength,
} from './file-formats'
import type {
  CompressionFileValidationWarning,
  CompressionFormatDefinition,
  ValidatedCompressionFile,
} from './types'

const GENERIC_MIME_TYPES = new Set([
  'application/octet-stream',
  'binary/octet-stream',
])

const normalizeMimeType = (mimeType: string) =>
  mimeType.split(';', 1)[0].trim().toLowerCase()

export async function validateCompressionFile(
  file: File,
  formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
): Promise<ValidatedCompressionFile> {
  if (file.size <= 0) {
    throw new CompressionCoreError(
      'empty-file',
      'El archivo está vacío y no se puede procesar.',
    )
  }

  const maximumSignatureLength = getMaximumSignatureLength(formats)
  const header = new Uint8Array(
    await file.slice(0, maximumSignatureLength).arrayBuffer(),
  )
  const detectedFormat = formats.find((format) =>
    format.matchesSignature(header),
  )

  if (!detectedFormat) {
    throw new CompressionCoreError(
      'unsupported-signature',
      'La firma del archivo no corresponde a un formato compatible.',
    )
  }

  const declaredMimeType = normalizeMimeType(file.type)
  const extension = getFileExtension(file.name)
  const warnings: CompressionFileValidationWarning[] = []

  if (!declaredMimeType) {
    warnings.push('missing-mime')
  } else if (GENERIC_MIME_TYPES.has(declaredMimeType)) {
    warnings.push('generic-mime')
  } else {
    const mimeFormat = findFormatByMimeType(declaredMimeType, formats)

    if (!mimeFormat || mimeFormat.id !== detectedFormat.id) {
      throw new CompressionCoreError(
        'mime-signature-mismatch',
        `El tipo MIME ${declaredMimeType} no coincide con la firma ${detectedFormat.label}.`,
      )
    }
  }

  if (!extension) {
    warnings.push('missing-extension')
  } else {
    const extensionFormat = findFormatByExtension(extension, formats)

    if (!extensionFormat || extensionFormat.id !== detectedFormat.id) {
      throw new CompressionCoreError(
        'extension-signature-mismatch',
        `La extensión .${extension} no coincide con la firma ${detectedFormat.label}.`,
      )
    }
  }

  return {
    declaredMimeType,
    detectedMimeType: detectedFormat.mimeType,
    extension,
    file,
    format: detectedFormat,
    warnings,
  }
}
