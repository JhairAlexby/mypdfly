import {
  createCanvas,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

Object.defineProperty(globalThis, 'DOMMatrix', {
  configurable: true,
  value: DOMMatrix,
})
Object.defineProperty(globalThis, 'ImageData', {
  configurable: true,
  value: ImageData,
})
Object.defineProperty(globalThis, 'Path2D', {
  configurable: true,
  value: Path2D,
})

export const loadPdfJsDocument = async (bytes: Uint8Array) => {
  const loadingTask = getDocument({
    data: bytes,
    useSystemFonts: true,
  })

  return {
    document: await loadingTask.promise,
    destroy: () => loadingTask.destroy(),
  }
}

export const renderPdfPage = async (
  page: Awaited<
    ReturnType<
      Awaited<ReturnType<typeof loadPdfJsDocument>>['document']['getPage']
    >
  >,
  scale: number,
) => {
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(
    Math.max(1, Math.ceil(viewport.width)),
    Math.max(1, Math.ceil(viewport.height)),
  )
  const renderTask = page.render({
    background: '#ffffff',
    canvas: canvas as unknown as HTMLCanvasElement,
    viewport,
  })
  await renderTask.promise

  return { canvas, viewport }
}
