import {
  assertCompressionFileWithinSizeLimit,
  CompressionCoreError,
  findFormatById,
  type CompressionProcessor,
} from '@/features/file-compression/core'
import { getSafeFileBaseName, throwIfAborted } from '@/lib/files'
import {
  processPdfInWorker,
  type PdfCodec,
  type PdfCodecResult,
} from './pdf-codec'

export const PDF_COMPRESSION_PROCESSOR_ID = 'pdf-structural'

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const

export type PdfDocumentInspection = Pick<
  PdfCodecResult,
  'hasDigitalSignature' | 'pageCount'
>

export type PdfProcessorDependencies = {
  readonly process: PdfCodec
}

const browserDependencies: PdfProcessorDependencies = {
  process: processPdfInWorker,
}

const assertPdfFileWithinSizeLimit = (file: File) => {
  const format = findFormatById('pdf')

  if (!format) {
    throw new CompressionCoreError(
      'unsupported-format',
      'No se encontró la definición del formato PDF.',
    )
  }

  assertCompressionFileWithinSizeLimit(file, format)
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
  assertPdfFileWithinSizeLimit(file)
  throwIfAborted(signal)
  const input = await file.arrayBuffer()
  throwIfAborted(signal)
  const result = await dependencies.process(input, { mode: 'inspect' }, signal)
  throwIfAborted(signal)
  const inspection = {
    hasDigitalSignature: result.hasDigitalSignature,
    pageCount: result.pageCount,
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
    assertPdfFileWithinSizeLimit(input.file)
    context.reportProgress({
      completed: 0,
      message: 'Leyendo estructura PDF…',
      phase: 'preparing',
      total: 3,
    })
    throwIfAborted(context.signal)

    const inputBytes = await input.file.arrayBuffer()
    throwIfAborted(context.signal)
    const result = await dependencies.process(
      inputBytes,
      { mode: 'compress' },
      context.signal,
    )
    throwIfAborted(context.signal)
    assertPdfCanBeRewritten(result)
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

    const optimizedOutput = result.output
    if (!optimizedOutput) {
      throw new CompressionCoreError(
        'invalid-processor-output',
        'El optimizador devolvió un archivo que no es un PDF válido.',
      )
    }

    const optimizedBytes = new Uint8Array(optimizedOutput)

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
      : new Blob([optimizedOutput], {
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
        pageCount: result.pageCount,
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
