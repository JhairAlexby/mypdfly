import {
  decodeBrowserImage,
  type BrowserImageDecoder,
  type DecodedBrowserImage,
} from '@/features/file-compression/processors/browser-image'
import { throwIfAborted } from '@/lib/files'
import type {
  DecodedModernImage,
} from '@/features/file-compression/processors/modern-image-processor'
import type { ModernImageFormat } from '@/features/file-compression/processors/modern-image-codec'
import { getImageMimeType } from './document'

export type DecodedImageSource = DecodedBrowserImage & {
  readonly previewUrl?: string
}

export type ModernImageDecoder = (
  file: File,
  format: ModernImageFormat,
  signal?: AbortSignal,
) => Promise<DecodedModernImage>

export type ImageSourceDependencies = {
  readonly decodeBrowserImage: BrowserImageDecoder
  readonly decodeModernImageFile: ModernImageDecoder
}

const getModernImageFormat = (file: File) => {
  const mimeType = getImageMimeType(file)
  if (mimeType === 'image/webp') return 'webp' as const
  if (mimeType === 'image/avif') return 'avif' as const
  return null
}

const defaultDependencies: ImageSourceDependencies = {
  decodeBrowserImage,
  decodeModernImageFile: async (file, format, signal) => {
    const { decodeModernImageFile } = await import(
      '@/features/file-compression/processors'
    )
    return decodeModernImageFile(file, format, signal)
  },
}

const createCanvasSource = (
  width: number,
  height: number,
  pixels: ArrayBuffer,
): DecodedImageSource => {
  if (typeof document === 'undefined') {
    throw new Error('Este navegador no permite preparar imágenes modernas.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: true })

  if (!context) {
    canvas.width = 1
    canvas.height = 1
    throw new Error('No se pudo crear un lienzo para decodificar la imagen.')
  }

  const imageData =
    typeof ImageData === 'function'
      ? new ImageData(new Uint8ClampedArray(pixels), width, height)
      : context.createImageData(width, height)
  if (!(typeof ImageData === 'function')) {
    imageData.data.set(new Uint8ClampedArray(pixels))
  }
  context.putImageData(imageData, 0, 0)

  const previewCanvas = document.createElement('canvas')
  const previewScale = Math.min(1, 1600 / Math.max(width, height))
  previewCanvas.width = Math.max(1, Math.round(width * previewScale))
  previewCanvas.height = Math.max(1, Math.round(height * previewScale))
  let previewUrl: string | undefined
  try {
    const previewContext = previewCanvas.getContext('2d')
    if (previewContext) {
      previewContext.drawImage(
        canvas,
        0,
        0,
        previewCanvas.width,
        previewCanvas.height,
      )
      previewUrl = previewCanvas.toDataURL('image/png')
    }
  } finally {
    previewCanvas.width = 1
    previewCanvas.height = 1
  }

  return {
    close: () => {
      canvas.width = 1
      canvas.height = 1
    },
    height,
    previewUrl,
    source: canvas,
    width,
  }
}

export const decodeImageFile = async (
  file: File,
  signal?: AbortSignal,
  dependencies: ImageSourceDependencies = defaultDependencies,
): Promise<DecodedImageSource> => {
  throwIfAborted(signal)

  try {
    const decoded = await dependencies.decodeBrowserImage(file)
    throwIfAborted(signal)
    return decoded
  } catch (error) {
    throwIfAborted(signal)
    const format = getModernImageFormat(file)
    if (!format) throw error

    const decoded = await dependencies.decodeModernImageFile(file, format, signal)
    throwIfAborted(signal)
    return createCanvasSource(decoded.width, decoded.height, decoded.pixels)
  }
}
