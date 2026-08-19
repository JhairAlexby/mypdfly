import {
  downloadBlob,
  getEditedDocumentBaseName,
} from './download-utils'
import { createZipArchive } from '@/lib/files/zip'
import {
  encodeCanvasAsImage,
  type ImageEncoderOptions,
  type ImageFormat,
} from './image-encoders'
import {
  ExportCancelledError,
  throwIfExportAborted,
} from './export-cancellation'
import { renderEditedPage } from './page-compositor'
import type { Annotation, PdfPageReference, PdfSource } from './types'

type ExportImagesOptions = {
  sources: PdfSource[]
  pages: PdfPageReference[]
  annotations: Annotation[]
  fileName: string
  format: ImageFormat
  combined?: boolean
  quality?: ImageEncoderOptions['quality']
  signal?: AbortSignal
  onProgress?: (currentPage: number, totalPages: number) => void
}

const IMAGE_EXTENSIONS: Record<ImageFormat, 'jpg' | 'png'> = {
  jpeg: 'jpg',
  png: 'png',
}

const getPageImageFileName = (
  fileName: string,
  format: ImageFormat,
  pageNumber: number,
  totalPages: number,
  combined: boolean,
) => {
  const editedBaseName = getEditedDocumentBaseName(fileName, combined)
  const paddedPageNumber = String(pageNumber).padStart(
    Math.max(2, String(totalPages).length),
    '0',
  )

  return `${editedBaseName}-pagina-${paddedPageNumber}.${IMAGE_EXTENSIONS[format]}`
}

export const getEditedImageFileName = (
  fileName: string,
  format: ImageFormat,
  combined = false,
) =>
  `${getEditedDocumentBaseName(fileName, combined)}.${IMAGE_EXTENSIONS[format]}`

export const getEditedImagesZipFileName = (
  fileName: string,
  combined = false,
) => `${getEditedDocumentBaseName(fileName, combined)}.zip`

export async function exportEditedImages({
  sources,
  pages,
  annotations,
  fileName,
  format,
  combined = false,
  quality,
  signal,
  onProgress,
}: ExportImagesOptions) {
  throwIfExportAborted(signal)
  if (!pages.length) throw new Error('No hay páginas para exportar.')

  const sourcesById = new Map(sources.map((source) => [source.id, source]))
  const zipEntries: Array<{ blob: Blob; fileName: string }> = []
  let singleImage: Blob | null = null

  for (const [pageIndex, pageReference] of pages.entries()) {
    throwIfExportAborted(signal)
    const source = sourcesById.get(pageReference.sourceId)
    if (!source) throw new Error('No se encontró una de las páginas del documento.')

    onProgress?.(pageIndex + 1, pages.length)
    throwIfExportAborted(signal)

    let renderedCanvas: HTMLCanvasElement | null = null

    try {
      const renderedPage = await renderEditedPage({
        source,
        pageReference,
        annotations,
        signal,
      })
      renderedCanvas = renderedPage.canvas

      const imageBlob = await encodeCanvasAsImage(renderedCanvas, format, {
        quality,
        signal,
      })
      throwIfExportAborted(signal)

      if (pages.length === 1) {
        singleImage = imageBlob
      } else {
        zipEntries.push({
          blob: imageBlob,
          fileName: getPageImageFileName(
            fileName,
            format,
            pageIndex + 1,
            pages.length,
            combined,
          ),
        })
      }
    } finally {
      if (renderedCanvas) {
        renderedCanvas.width = 1
        renderedCanvas.height = 1
      }
    }
  }

  if (singleImage) {
    throwIfExportAborted(signal)
    downloadBlob(singleImage, getEditedImageFileName(fileName, format, combined))
    return
  }

  const archive = await createZipArchive(zipEntries, {
    createCancellationError: () => new ExportCancelledError(),
    signal,
  })
  throwIfExportAborted(signal)
  downloadBlob(archive, getEditedImagesZipFileName(fileName, combined))
}
