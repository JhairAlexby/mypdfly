import type {
  Annotation,
  PdfPageReference,
  PdfSource,
} from './types'
import { downloadBlob, getEditedDocumentBaseName } from './download-utils'
import { encodeCanvasToPng } from './image-encoders'
import { renderEditedPage } from './page-compositor'

type ExportPdfOptions = {
  sources: PdfSource[]
  pages: PdfPageReference[]
  annotations: Annotation[]
  fileName: string
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
  onProgress,
}: ExportPdfOptions) {
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const sourcesById = new Map(sources.map((source) => [source.id, source]))

  for (const [pageIndex, pageReference] of pages.entries()) {
    const source = sourcesById.get(pageReference.sourceId)
    if (!source) throw new Error('No se encontró una de las páginas del documento.')

    onProgress?.(pageIndex + 1, pages.length)
    const { canvas, logicalWidth, logicalHeight } = await renderEditedPage({
      source,
      pageReference,
      annotations,
    })
    const imageBlob = await encodeCanvasToPng(canvas)
    const imageBytes = await imageBlob.arrayBuffer()
    const image = await output.embedPng(imageBytes)
    const outputPage = output.addPage([logicalWidth, logicalHeight])
    outputPage.drawImage(image, {
      x: 0,
      y: 0,
      width: logicalWidth,
      height: logicalHeight,
    })

    canvas.width = 1
    canvas.height = 1
  }

  const bytes = await output.save()
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: 'application/pdf',
  })
  downloadBlob(blob, fileName)
}
