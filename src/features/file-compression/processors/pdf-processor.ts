import {
  PDFDict,
  PDFDocument,
  PDFName,
  type SaveOptions,
} from 'pdf-lib'

import {
  CompressionCoreError,
  type CompressionProcessor,
} from '@/features/file-compression/core'
import { getSafeFileBaseName, throwIfAborted } from '@/lib/files'

export const PDF_COMPRESSION_PROCESSOR_ID = 'pdf-structural'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

const PDF_SAVE_OPTIONS = {
  addDefaultPage: false,
  objectsPerTick: 100,
  updateFieldAppearances: false,
  useObjectStreams: true,
} as const satisfies SaveOptions

export type PdfDocumentInspection = {
  readonly hasDigitalSignature: boolean
  readonly pageCount: number
}

export type LoadedPdfForCompression = PdfDocumentInspection & {
  readonly save: () => Promise<Uint8Array>
}

export type PdfProcessorDependencies = {
  readonly load: (input: Uint8Array) => Promise<LoadedPdfForCompression>
}

const hasDigitalSignature = (document: PDFDocument) => {
  const signatureFieldType = PDFName.of('Sig')
  const fieldTypeKey = PDFName.of('FT')
  const byteRangeKey = PDFName.of('ByteRange')
  const acroForm = document.catalog.getAcroForm()

  const hasSignatureField =
    acroForm?.getAllFields().some(([field]) =>
      field.getInheritableAttribute(fieldTypeKey) === signatureFieldType,
    ) ?? false
  const hasSignedDictionary = document.context
    .enumerateIndirectObjects()
    .some(([, object]) =>
      object instanceof PDFDict && object.has(byteRangeKey),
    )

  return hasSignatureField || hasSignedDictionary
}

const loadPdfForCompression = async (
  input: Uint8Array,
): Promise<LoadedPdfForCompression> => {
  let document: PDFDocument

  try {
    document = await PDFDocument.load(input, { updateMetadata: false })
  } catch {
    throw new CompressionCoreError(
      'invalid-pdf',
      'No se pudo abrir el PDF. Puede estar cifrado, protegido o dañado.',
    )
  }

  return {
    hasDigitalSignature: hasDigitalSignature(document),
    pageCount: document.getPageCount(),
    save: () => document.save(PDF_SAVE_OPTIONS),
  }
}

const browserDependencies: PdfProcessorDependencies = {
  load: loadPdfForCompression,
}

const assertPdfCanBeRewritten = (
  inspection: PdfDocumentInspection,
) => {
  if (inspection.hasDigitalSignature) {
    throw new CompressionCoreError(
      'protected-pdf',
      'Este PDF contiene una firma digital. Optimizarlo invalidaría la firma, por eso se conserva sin cambios.',
    )
  }

  if (inspection.pageCount <= 0) {
    throw new CompressionCoreError(
      'invalid-pdf',
      'El PDF no contiene páginas que se puedan optimizar.',
    )
  }
}

export const inspectPdfFile = async (
  file: File,
  signal?: AbortSignal,
  dependencies: PdfProcessorDependencies = browserDependencies,
): Promise<PdfDocumentInspection> => {
  throwIfAborted(signal)
  const input = new Uint8Array(await file.arrayBuffer())
  throwIfAborted(signal)
  const document = await dependencies.load(input)
  throwIfAborted(signal)
  const inspection = {
    hasDigitalSignature: document.hasDigitalSignature,
    pageCount: document.pageCount,
  }
  assertPdfCanBeRewritten(inspection)
  return inspection
}

export const createPdfCompressionProcessor = (
  dependencies: PdfProcessorDependencies = browserDependencies,
): CompressionProcessor => ({
  id: PDF_COMPRESSION_PROCESSOR_ID,
  label: 'Optimizador estructural PDF',
  formatIds: ['pdf'],
  compress: async (input, _options, context) => {
    context.reportProgress({
      completed: 0,
      message: 'Leyendo estructura PDF…',
      phase: 'preparing',
      total: 3,
    })
    throwIfAborted(context.signal)

    const inputBytes = new Uint8Array(await input.file.arrayBuffer())
    throwIfAborted(context.signal)
    const document = await dependencies.load(inputBytes)
    throwIfAborted(context.signal)
    assertPdfCanBeRewritten(document)
    context.reportProgress({
      completed: 1,
      message: 'Estructura validada',
      phase: 'preparing',
      total: 3,
    })
    context.reportProgress({
      completed: 2,
      message: 'Optimizando objetos PDF…',
      phase: 'compressing',
      total: 3,
    })

    const optimizedBytes = await document.save()
    throwIfAborted(context.signal)

    if (
      optimizedBytes.byteLength <= PDF_SIGNATURE.length ||
      !PDF_SIGNATURE.every(
        (byte, index) => optimizedBytes[index] === byte,
      )
    ) {
      throw new CompressionCoreError(
        'invalid-processor-output',
        'El optimizador devolvió un archivo que no es un PDF válido.',
      )
    }

    const usedOriginal = optimizedBytes.byteLength >= input.file.size
    const blob = usedOriginal
      ? new Blob([input.file], { type: 'application/pdf' })
      : new Blob([Uint8Array.from(optimizedBytes).buffer], {
          type: 'application/pdf',
        })

    context.reportProgress({
      completed: 3,
      message: 'PDF listo',
      phase: 'finalizing',
      total: 3,
    })

    return {
      blob,
      fileName: `${getSafeFileBaseName(input.file.name)}-comprimido.pdf`,
      metadata: {
        mode: 'structural',
        pageCount: document.pageCount,
        preservesInteractiveContent: true,
        usedOriginal,
        useObjectStreams: true,
      },
      warnings: usedOriginal
        ? [
            'El PDF ya tenía una estructura eficiente; se conservaron sus bytes originales.',
          ]
        : [],
    }
  },
})

export const pdfCompressionProcessor = createPdfCompressionProcessor()
