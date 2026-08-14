import { zip } from 'fflate'

import {
  downloadBlob,
  getEditedDocumentBaseName,
} from './download-utils'
import {
  encodeCanvasAsImage,
  type ImageEncoderOptions,
  type ImageFormat,
} from './image-encoders'
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
  onProgress?: (currentPage: number, totalPages: number) => void
}

const IMAGE_EXTENSIONS: Record<ImageFormat, 'jpg' | 'png'> = {
  jpeg: 'jpg',
  png: 'png',
}

const createZipBlob = (entries: Record<string, Uint8Array>) =>
  new Promise<Blob>((resolve, reject) => {
    try {
      zip(entries, { level: 0 }, (error, bytes) => {
        if (error) {
          reject(error)
          return
        }

        resolve(new Blob([bytes], { type: 'application/zip' }))
      })
    } catch (error) {
      reject(error)
    }
  })

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
  onProgress,
}: ExportImagesOptions) {
  if (!pages.length) throw new Error('No hay páginas para exportar.')

  const sourcesById = new Map(sources.map((source) => [source.id, source]))
  const zipEntries: Record<string, Uint8Array> = {}
  let singleImage: Blob | null = null

  for (const [pageIndex, pageReference] of pages.entries()) {
    const source = sourcesById.get(pageReference.sourceId)
    if (!source) throw new Error('No se encontró una de las páginas del documento.')

    onProgress?.(pageIndex + 1, pages.length)

    let renderedCanvas: HTMLCanvasElement | null = null

    try {
      const renderedPage = await renderEditedPage({
        source,
        pageReference,
        annotations,
      })
      renderedCanvas = renderedPage.canvas

      const imageBlob = await encodeCanvasAsImage(renderedCanvas, format, {
        quality,
      })

      if (pages.length === 1) {
        singleImage = imageBlob
      } else {
        zipEntries[getPageImageFileName(
          fileName,
          format,
          pageIndex + 1,
          pages.length,
          combined,
        )] = new Uint8Array(await imageBlob.arrayBuffer())
      }
    } finally {
      if (renderedCanvas) {
        renderedCanvas.width = 1
        renderedCanvas.height = 1
      }
    }
  }

  if (singleImage) {
    downloadBlob(singleImage, getEditedImageFileName(fileName, format, combined))
    return
  }

  const archive = await createZipBlob(zipEntries)
  downloadBlob(archive, getEditedImagesZipFileName(fileName, combined))
}
