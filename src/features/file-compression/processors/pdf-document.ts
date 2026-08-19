import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  type SaveOptions,
} from 'pdf-lib'

import { CompressionCoreError } from '@/features/file-compression/core/errors'
import type {
  PdfCodecOptions,
  PdfCodecResult,
} from './pdf-codec'

const PDF_SAVE_OPTIONS = {
  addDefaultPage: false,
  objectsPerTick: 100,
  updateFieldAppearances: false,
  useObjectStreams: true,
} as const satisfies SaveOptions

const FIELD_TYPE_KEY = PDFName.of('FT')
const SIGNATURE_FIELD_TYPE = PDFName.of('Sig')
const BYTE_RANGE_KEY = PDFName.of('ByteRange')

const hasValidByteRange = (
  signatureValue: PDFDict,
  inputSize: number,
) => {
  const byteRange = signatureValue.lookup(BYTE_RANGE_KEY)

  if (
    !(byteRange instanceof PDFArray) ||
    byteRange.size() < 4 ||
    byteRange.size() % 2 !== 0
  ) {
    return false
  }

  const values: number[] = []
  for (let index = 0; index < byteRange.size(); index += 1) {
    const value = byteRange.lookup(index)

    if (!(value instanceof PDFNumber)) return false
    const numericValue = value.asNumber()
    if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
      return false
    }
    values.push(numericValue)
  }

  if (values[0] !== 0) return false

  let previousEnd = 0
  for (let index = 0; index < values.length; index += 2) {
    const offset = values[index]
    const length = values[index + 1]
    const end = offset + length

    if (length <= 0 || offset < previousEnd || end > inputSize) {
      return false
    }
    previousEnd = end
  }

  return true
}

const hasDigitalSignature = (
  document: PDFDocument,
  inputSize: number,
) => {
  const fields = document.catalog.getAcroForm()?.getAllFields() ?? []

  return fields.some(([field]) => {
    const fieldTypeValue = field.getInheritableAttribute(FIELD_TYPE_KEY)
    const fieldType = fieldTypeValue
      ? document.context.lookup(fieldTypeValue)
      : undefined

    if (fieldType !== SIGNATURE_FIELD_TYPE) return false

    const signatureValue = field.V()
    return (
      signatureValue instanceof PDFDict &&
      hasValidByteRange(signatureValue, inputSize)
    )
  })
}

export const processPdfDocument = async (
  input: ArrayBuffer,
  options: PdfCodecOptions,
): Promise<PdfCodecResult> => {
  let document: PDFDocument

  try {
    document = await PDFDocument.load(new Uint8Array(input), {
      updateMetadata: false,
    })
  } catch {
    throw new CompressionCoreError(
      'invalid-pdf',
      'No se pudo abrir el PDF. Puede estar cifrado, protegido o dañado.',
    )
  }

  const result = {
    hasDigitalSignature: hasDigitalSignature(document, input.byteLength),
    pageCount: document.getPageCount(),
  }

  if (
    options.mode === 'inspect' ||
    result.hasDigitalSignature ||
    result.pageCount <= 0
  ) {
    return result
  }

  const output = await document.save(PDF_SAVE_OPTIONS)
  return {
    ...result,
    output: Uint8Array.from(output).buffer,
  }
}
