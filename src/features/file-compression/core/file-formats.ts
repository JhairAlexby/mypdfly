import type { CompressionFormatDefinition } from './types'

const startsWithBytes = (
  bytes: Uint8Array,
  signature: readonly number[],
) =>
  bytes.length >= signature.length &&
  signature.every((byte, index) => bytes[index] === byte)

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

export const DEFAULT_COMPRESSION_FORMATS = [
  {
    id: 'pdf',
    label: 'PDF',
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
