import type {
  CompressionOptions,
  CompressionProcessor,
} from '@/features/file-compression/core'
import {
  encodeCanvasToJpeg,
  getSafeFileBaseName,
  throwIfAborted,
} from '@/lib/files'

export const JPEG_COMPRESSION_PROCESSOR_ID = 'jpeg-browser'
export const DEFAULT_JPEG_COMPRESSION_QUALITY = 0.8
export const MINIMUM_JPEG_COMPRESSION_QUALITY = 0.1

export type JpegInspection = {
  readonly height: number
  readonly width: number
}

export type DecodedJpegImage = JpegInspection & {
  readonly source: CanvasImageSource
  readonly close: () => void
}

export type JpegProcessorDependencies = {
  readonly createCanvas: (
    width: number,
    height: number,
  ) => HTMLCanvasElement
  readonly decodeImage: (file: File) => Promise<DecodedJpegImage>
  readonly encode: typeof encodeCanvasToJpeg
}

const decodeImageInBrowser = async (file: File): Promise<DecodedJpegImage> => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador no permite decodificar imágenes JPEG.')
  }

  const bitmap = await createImageBitmap(file, {
    imageOrientation: 'from-image',
  })

  return {
    close: () => bitmap.close(),
    height: bitmap.height,
    source: bitmap,
    width: bitmap.width,
  }
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
  decodeImage: decodeImageInBrowser,
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

const assertValidDimensions = ({ height, width }: JpegInspection) => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('La imagen JPEG no tiene dimensiones válidas.')
  }
}

export const inspectJpegFile = async (
  file: File,
  signal?: AbortSignal,
  dependencies: Pick<JpegProcessorDependencies, 'decodeImage'> = browserDependencies,
): Promise<JpegInspection> => {
  throwIfAborted(signal)
  let decodedImage: DecodedJpegImage | undefined

  try {
    decodedImage = await dependencies.decodeImage(file)
    throwIfAborted(signal)
    assertValidDimensions(decodedImage)

    return {
      height: decodedImage.height,
      width: decodedImage.width,
    }
  } catch (error) {
    throwIfAborted(signal)
    throw new Error(
      'No se pudo leer la imagen JPEG. Verifica que el archivo no esté dañado.',
      { cause: error },
    )
  } finally {
    decodedImage?.close()
  }
}

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
      assertValidDimensions(decodedImage)

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
