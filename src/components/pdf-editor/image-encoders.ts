export type ImageFormat = 'jpeg' | 'png'

export type ImageEncoderOptions = {
  quality?: number
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

const encodeCanvas = (
  canvas: HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/png',
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    const onEncoded = (blob: Blob | null) => {
      if (!blob) {
        reject(new Error(`No se pudo codificar la imagen como ${mimeType}.`))
        return
      }

      if (blob.type.toLowerCase() !== mimeType) {
        reject(
          new Error(
            `El codificador devolvió ${blob.type || 'un tipo desconocido'} en lugar de ${mimeType}.`,
          ),
        )
        return
      }

      resolve(blob)
    }

    if (mimeType === 'image/jpeg') {
      canvas.toBlob(onEncoded, mimeType, quality)
    } else {
      canvas.toBlob(onEncoded, mimeType)
    }
  })

export const encodeCanvasAsImage = (
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  options: ImageEncoderOptions = {},
) => {
  const mimeType = IMAGE_MIME_TYPES[format]
  const quality =
    format === 'jpeg'
      ? normalizeJpegQuality(options.quality ?? DEFAULT_JPEG_QUALITY)
      : undefined

  return encodeCanvas(canvas, mimeType, quality)
}

export const encodeCanvasToPng = (canvas: HTMLCanvasElement) =>
  encodeCanvasAsImage(canvas, 'png')

export const encodeCanvasToJpeg = (
  canvas: HTMLCanvasElement,
  quality = DEFAULT_JPEG_QUALITY,
) => encodeCanvasAsImage(canvas, 'jpeg', { quality })
