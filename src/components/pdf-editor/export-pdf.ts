import type {
  Annotation,
  PdfPageReference,
  PdfSource,
} from './types'
import { downloadBlob, getEditedDocumentBaseName } from './download-utils'
import { encodeCanvasToPng } from './image-encoders'
import { throwIfExportAborted } from './export-cancellation'
import { renderEditedPage } from './page-compositor'

type ExportPdfOptions = {
  sources: PdfSource[]
  pages: PdfPageReference[]
  annotations: Annotation[]
  fileName: string
  signal?: AbortSignal
  onProgress?: (currentPage: number, totalPages: number) => void
}

export const getEditedPdfFileName = (fileName: string, combined: boolean) => {
  return `${getEditedDocumentBaseName(fileName, combined)}.pdf`
}

export async function exportEditedPdf({
  sources,
  pages,
  annotations,
  fileName,
  signal,
  onProgress,
}: ExportPdfOptions) {
  throwIfExportAborted(signal)
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const sourcesById = new Map(sources.map((source) => [source.id, source]))

  for (const [pageIndex, pageReference] of pages.entries()) {
    throwIfExportAborted(signal)
    const source = sourcesById.get(pageReference.sourceId)
    if (!source) throw new Error('No se encontró una de las páginas del documento.')

    onProgress?.(pageIndex + 1, pages.length)
    let canvas: HTMLCanvasElement | null = null

    try {
      const renderedPage = await renderEditedPage({
        source,
        pageReference,
        annotations,
        signal,
      })
      canvas = renderedPage.canvas
      throwIfExportAborted(signal)

      const imageBlob = await encodeCanvasToPng(canvas, { signal })
      throwIfExportAborted(signal)
      const imageBytes = await imageBlob.arrayBuffer()
      const image = await output.embedPng(imageBytes)
      const outputPage = output.addPage([
        renderedPage.logicalWidth,
        renderedPage.logicalHeight,
      ])
      outputPage.drawImage(image, {
        x: 0,
        y: 0,
        width: renderedPage.logicalWidth,
        height: renderedPage.logicalHeight,
      })
    } finally {
      if (canvas) {
        canvas.width = 1
        canvas.height = 1
      }
    }
  }

  throwIfExportAborted(signal)
  const bytes = await output.save()
  throwIfExportAborted(signal)
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: 'application/pdf',
  })
  downloadBlob(blob, fileName)
}
