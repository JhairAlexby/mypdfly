import type { CompressionFormatDefinition } from './types'

const startsWithBytes = (
  bytes: Uint8Array,
  signature: readonly number[],
) =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => bytes[index] === byte)

const containsAsciiAt = (
  bytes: Uint8Array,
  offset: number,
  value: string,
) =>
  offset >= 0 &&
  offset + value.length <= bytes.length &&
  [...value].every(
    (character, index) =>
      bytes[offset + index] === character.charCodeAt(0),
  )

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const
const PNG_SIGNATURE = [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
] as const
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const
const WEBP_SIGNATURE_LENGTH = 12
const AVIF_SIGNATURE_LENGTH = 64

export const MAXIMUM_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024

const readUint32BigEndian = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] * 0x1000000) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]) >>> 0

export const hasIsoBmffFileTypeBrand = (
  bytes: Uint8Array,
  brand: string,
) => {
  if (
    brand.length !== 4 ||
    bytes.length < 12 ||
    !containsAsciiAt(bytes, 4, 'ftyp')
  ) {
    return false
  }

  const declaredBoxSize = readUint32BigEndian(bytes, 0)
  const boxEnd =
    declaredBoxSize === 0
      ? bytes.length
      : Math.min(bytes.length, declaredBoxSize)

  if (boxEnd < 12 || declaredBoxSize === 1) return false
  if (containsAsciiAt(bytes, 8, brand)) return true

  for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
    if (containsAsciiAt(bytes, offset, brand)) return true
  }

  return false
}

const matchesWebpSignature = (bytes: Uint8Array) =>
  containsAsciiAt(bytes, 0, 'RIFF') &&
  containsAsciiAt(bytes, 8, 'WEBP')

const matchesAvifSignature = (bytes: Uint8Array) => {
  return (
    hasIsoBmffFileTypeBrand(bytes, 'avif') ||
    hasIsoBmffFileTypeBrand(bytes, 'avis')
  )
}

export const DEFAULT_COMPRESSION_FORMATS = [
  {
    id: 'pdf',
    label: 'PDF',
    maximumFileSizeBytes: MAXIMUM_PDF_FILE_SIZE_BYTES,
    mimeType: 'application/pdf',
    mimeTypes: ['application/pdf'],
    extensions: ['pdf'],
    signatureLength: PDF_SIGNATURE.length,
    matchesSignature: (bytes) => startsWithBytes(bytes, PDF_SIGNATURE),
  },
  {
    id: 'png',
    label: 'PNG',
    mimeType: 'image/png',
    mimeTypes: ['image/png'],
    extensions: ['png'],
    signatureLength: PNG_SIGNATURE.length,
    matchesSignature: (bytes) => startsWithBytes(bytes, PNG_SIGNATURE),
  },
  {
    id: 'jpeg',
    label: 'JPEG',
    mimeType: 'image/jpeg',
    mimeTypes: ['image/jpeg', 'image/jpg'],
    extensions: ['jpg', 'jpeg'],
    signatureLength: JPEG_SIGNATURE.length,
    matchesSignature: (bytes) => startsWithBytes(bytes, JPEG_SIGNATURE),
  },
  {
    id: 'webp',
    label: 'WebP',
    mimeType: 'image/webp',
    mimeTypes: ['image/webp'],
    extensions: ['webp'],
    signatureLength: WEBP_SIGNATURE_LENGTH,
    matchesSignature: matchesWebpSignature,
  },
  {
    id: 'avif',
    label: 'AVIF',
    mimeType: 'image/avif',
    mimeTypes: ['image/avif'],
    extensions: ['avif'],
    signatureLength: AVIF_SIGNATURE_LENGTH,
    matchesSignature: matchesAvifSignature,
  },
] as const satisfies readonly CompressionFormatDefinition[]

export const getMaximumSignatureLength = (
  formats: readonly CompressionFormatDefinition[],
) => Math.max(0, ...formats.map((format) => format.signatureLength))

export const findFormatByMimeType = (
  mimeType: string,
  formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
) => formats.find((format) => format.mimeTypes.includes(mimeType))

export const findFormatByExtension = (
  extension: string,
  formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
) => formats.find((format) => format.extensions.includes(extension))

export const findFormatById = (
  formatId: string,
  formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
) => formats.find((format) => format.id === formatId)
