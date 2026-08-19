import type {
  CompressionOptions,
  CompressionProcessor,
} from '@/features/file-compression/core'
import {
  encodeCanvasToJpeg,
  getSafeFileBaseName,
  throwIfAborted,
} from '@/lib/files'
import {
  assertValidImageDimensions,
  decodeBrowserImage,
  inspectBrowserImageFile,
  type BrowserImageDecoder,
  type BrowserImageInspection,
  type DecodedBrowserImage,
} from './browser-image'

export const JPEG_COMPRESSION_PROCESSOR_ID = 'jpeg-browser'
export const DEFAULT_JPEG_COMPRESSION_QUALITY = 0.8
export const MINIMUM_JPEG_COMPRESSION_QUALITY = 0.1

export type JpegInspection = BrowserImageInspection
export type DecodedJpegImage = DecodedBrowserImage

export type JpegProcessorDependencies = {
  readonly createCanvas: (
    width: number,
    height: number,
  ) => HTMLCanvasElement
  readonly decodeImage: BrowserImageDecoder
  readonly encode: typeof encodeCanvasToJpeg
}

const createCanvasInBrowser = (width: number, height: number) => {
  if (typeof document === 'undefined') {
    throw new Error('No se encontró un lienzo disponible para comprimir.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const browserDependencies: JpegProcessorDependencies = {
  createCanvas: createCanvasInBrowser,
  decodeImage: decodeBrowserImage,
  encode: encodeCanvasToJpeg,
}

const normalizeQuality = (options: CompressionOptions) => {
  const requestedQuality = options.quality

  if (
    typeof requestedQuality !== 'number' ||
    !Number.isFinite(requestedQuality)
  ) {
    return DEFAULT_JPEG_COMPRESSION_QUALITY
  }

  return Math.min(
    1,
    Math.max(MINIMUM_JPEG_COMPRESSION_QUALITY, requestedQuality),
  )
}

export const inspectJpegFile = inspectBrowserImageFile

export const createJpegCompressionProcessor = (
  dependencies: JpegProcessorDependencies = browserDependencies,
): CompressionProcessor => ({
  id: JPEG_COMPRESSION_PROCESSOR_ID,
  label: 'Compresor JPEG del navegador',
  formatIds: ['jpeg'],
  compress: async (input, options, context) => {
    const quality = normalizeQuality(options)
    let canvas: HTMLCanvasElement | undefined
    let decodedImage: DecodedJpegImage | undefined

    context.reportProgress({
      completed: 0,
      message: 'Preparando imagen…',
      phase: 'preparing',
      total: 3,
    })
    throwIfAborted(context.signal)

    try {
      decodedImage = await dependencies.decodeImage(input.file)
      throwIfAborted(context.signal)
      assertValidImageDimensions(decodedImage)

      context.reportProgress({
        completed: 1,
        message: 'Imagen preparada',
        phase: 'preparing',
        total: 3,
      })

      canvas = dependencies.createCanvas(
        decodedImage.width,
        decodedImage.height,
      )
      const canvasContext = canvas.getContext('2d', { alpha: false })

      if (!canvasContext) {
        throw new Error('No se pudo preparar el lienzo para comprimir.')
      }

      canvasContext.drawImage(decodedImage.source, 0, 0)
      throwIfAborted(context.signal)
      context.reportProgress({
        completed: 2,
        message: 'Comprimiendo JPEG…',
        phase: 'compressing',
        total: 3,
      })

      const blob = await dependencies.encode(canvas, quality, {
        signal: context.signal,
      })
      throwIfAborted(context.signal)
      context.reportProgress({
        completed: 3,
        message: 'JPEG listo',
        phase: 'finalizing',
        total: 3,
      })

      return {
        blob,
        fileName: `${getSafeFileBaseName(input.file.name)}-comprimido.jpg`,
        metadata: {
          height: decodedImage.height,
          quality,
          width: decodedImage.width,
        },
        warnings: [
          'Los metadatos EXIF del archivo original no se conservan.',
        ],
      }
    } finally {
      decodedImage?.close()

      if (canvas) {
        canvas.width = 1
        canvas.height = 1
      }
    }
  },
})

export const jpegCompressionProcessor = createJpegCompressionProcessor()
