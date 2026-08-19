import { throwIfAborted } from '@/lib/files'

export type BrowserImageInspection = {
  readonly height: number
  readonly width: number
}

export type DecodedBrowserImage = BrowserImageInspection & {
  readonly source: CanvasImageSource
  readonly close: () => void
}

export type BrowserImageDecoder = (
  file: File,
) => Promise<DecodedBrowserImage>

export const decodeBrowserImage: BrowserImageDecoder = async (file) => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador no permite decodificar imágenes.')
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

export const assertValidImageDimensions = ({
  height,
  width,
}: BrowserImageInspection) => {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('La imagen no tiene dimensiones válidas.')
  }
}

export const inspectBrowserImageFile = async (
  file: File,
  signal?: AbortSignal,
  dependencies: { readonly decodeImage: BrowserImageDecoder } = {
    decodeImage: decodeBrowserImage,
  },
): Promise<BrowserImageInspection> => {
  throwIfAborted(signal)
  let decodedImage: DecodedBrowserImage | undefined

  try {
    decodedImage = await dependencies.decodeImage(file)
    throwIfAborted(signal)
    assertValidImageDimensions(decodedImage)

    return {
      height: decodedImage.height,
      width: decodedImage.width,
    }
  } catch (error) {
    throwIfAborted(signal)
    throw new Error(
      'No se pudo leer la imagen. Verifica que el archivo no esté dañado.',
      { cause: error },
    )
  } finally {
    decodedImage?.close()
  }
}
