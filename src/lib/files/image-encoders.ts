import {
  OperationCancelledError,
  type CancellationErrorFactory,
} from './cancellation'

export type ImageFormat = 'jpeg' | 'png'

export type ImageEncoderOptions = {
  quality?: number
  signal?: AbortSignal
}

export const DEFAULT_JPEG_QUALITY = 0.9

const IMAGE_MIME_TYPES: Record<ImageFormat, 'image/jpeg' | 'image/png'> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
}

const normalizeJpegQuality = (quality: number) => {
  const finiteQuality = Number.isFinite(quality)
    ? quality
    : DEFAULT_JPEG_QUALITY

  return Math.min(1, Math.max(0, finiteQuality))
}

const createDefaultCancellationError = () => new OperationCancelledError()

export const createImageEncoder = (
  createCancellationError: CancellationErrorFactory = createDefaultCancellationError,
) => {
  const encodeCanvas = (
    canvas: HTMLCanvasElement,
    mimeType: 'image/jpeg' | 'image/png',
    quality?: number,
    signal?: AbortSignal,
  ) =>
    new Promise<Blob>((resolve, reject) => {
      let settled = false

      const cleanup = () => signal?.removeEventListener('abort', onAbort)
      const finish = (callback: () => void) => {
        if (settled) return
        settled = true
        cleanup()
        callback()
      }
      const onAbort = () =>
        finish(() => reject(createCancellationError()))

      if (signal?.aborted) {
        onAbort()
        return
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      const onEncoded = (blob: Blob | null) => {
        if (settled) return

        if (!blob) {
          finish(() =>
            reject(new Error(`No se pudo codificar la imagen como ${mimeType}.`)),
          )
          return
        }

        if (blob.type.toLowerCase() !== mimeType) {
          finish(() =>
            reject(
              new Error(
                `El codificador devolvió ${blob.type || 'un tipo desconocido'} en lugar de ${mimeType}.`,
              ),
            ),
          )
          return
        }

        finish(() => resolve(blob))
      }

      try {
        if (mimeType === 'image/jpeg') {
          canvas.toBlob(onEncoded, mimeType, quality)
        } else {
          canvas.toBlob(onEncoded, mimeType)
        }
      } catch (error) {
        finish(() => reject(error))
      }
    })

  const encodeCanvasAsImage = (
    canvas: HTMLCanvasElement,
    format: ImageFormat,
    options: ImageEncoderOptions = {},
  ) => {
    const mimeType = IMAGE_MIME_TYPES[format]
    const quality =
      format === 'jpeg'
        ? normalizeJpegQuality(options.quality ?? DEFAULT_JPEG_QUALITY)
        : undefined

    return encodeCanvas(canvas, mimeType, quality, options.signal)
  }

  const encodeCanvasToPng = (
    canvas: HTMLCanvasElement,
    options: ImageEncoderOptions = {},
  ) => encodeCanvasAsImage(canvas, 'png', options)

  const encodeCanvasToJpeg = (
    canvas: HTMLCanvasElement,
    quality = DEFAULT_JPEG_QUALITY,
    options: Omit<ImageEncoderOptions, 'quality'> = {},
  ) => encodeCanvasAsImage(canvas, 'jpeg', { ...options, quality })

  return {
    encodeCanvasAsImage,
    encodeCanvasToJpeg,
    encodeCanvasToPng,
  }
}

const defaultImageEncoder = createImageEncoder()

export const encodeCanvasAsImage = defaultImageEncoder.encodeCanvasAsImage
export const encodeCanvasToJpeg = defaultImageEncoder.encodeCanvasToJpeg
export const encodeCanvasToPng = defaultImageEncoder.encodeCanvasToPng
