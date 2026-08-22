import type { ImageFilter } from './image-filters'
import type { ImageScannerState, ScannerCorners } from './scanner/types'

export const IMAGE_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
].join(',')

export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const

export const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
] as const

export const MAX_IMAGE_COUNT = 50
export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024
export const MAX_TOTAL_IMAGE_SIZE_BYTES = 100 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
export const MAX_TOTAL_IMAGE_PIXELS = 100_000_000

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

export type ImageAsset = {
  readonly id: string
  readonly file: File
  readonly filter: ImageFilter
  readonly previewUrl: string
  readonly scanner: ImageScannerState
  readonly width: number
  readonly height: number
  readonly rotation: 0 | 90 | 180 | 270
}

/**
 * @deprecated Use ImageAsset. The legacy name is kept while the current
 * one-image-per-page workflow is migrated to the composition model.
 */
export type ImageDocumentItem = ImageAsset

export type ImageValidationCode =
  | 'empty-file'
  | 'unsupported-format'
  | 'mime-extension-mismatch'
  | 'file-too-large'
  | 'image-too-many-pixels'
  | 'too-many-files'
  | 'total-size-too-large'
  | 'total-pixels-too-large'
  | 'duplicate-file'

export type ImageValidationResult =
  | { readonly valid: true; readonly mimeType: ImageMimeType }
  | {
      readonly valid: false
      readonly code: ImageValidationCode
      readonly message: string
    }

export type ImageValidationContext = {
  readonly existingFiles?: readonly File[]
  readonly existingCount?: number
  readonly existingTotalBytes?: number
  readonly existingTotalPixels?: number
  readonly height?: number
  readonly width?: number
}

const extensionFromName = (name: string) => {
  const extension = name.toLowerCase().split('.').pop()
  return extension && extension !== name.toLowerCase() ? extension : ''
}

const mimeFromExtension = (extension: string): ImageMimeType | null => {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'png') return 'image/png'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'avif') return 'image/avif'
  return null
}

const normalizeMime = (mimeType: string) =>
  mimeType.split(';', 1)[0].trim().toLowerCase()

const formatMegabytes = (bytes: number) =>
  `${Math.round(bytes / (1024 * 1024))} MB`

const formatMegapixels = (pixels: number) =>
  `${Math.round(pixels / 1_000_000)} MP`

export const getImagePixelCount = (width: number, height: number) =>
  Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width * height
    : 0

export const getImageMimeType = (file: File): ImageMimeType | null => {
  const declaredMimeType = normalizeMime(file.type)
  const extensionMimeType = mimeFromExtension(extensionFromName(file.name))

  if (declaredMimeType === 'image/jpg') return 'image/jpeg'
  if (IMAGE_MIME_TYPES.includes(declaredMimeType as ImageMimeType)) {
    return declaredMimeType as ImageMimeType
  }
  return extensionMimeType
}

export const getImageFileIdentity = (file: File) =>
  [file.name, file.size, file.lastModified, normalizeMime(file.type)].join('|')

export const validateImageFile = (
  file: File,
  context: ImageValidationContext = {},
): ImageValidationResult => {
  if (file.size <= 0) {
    return {
      code: 'empty-file',
      message: 'El archivo está vacío.',
      valid: false,
    }
  }

  const extension = extensionFromName(file.name)
  const extensionMimeType = mimeFromExtension(extension)
  const declaredMimeType = normalizeMime(file.type)
  const normalizedDeclaredMimeType =
    declaredMimeType === 'image/jpg' ? 'image/jpeg' : declaredMimeType
  const mimeType = getImageMimeType(file)

  if (!mimeType) {
    return {
      code: 'unsupported-format',
      message: 'Solo se aceptan imágenes JPEG, PNG, WebP o AVIF.',
      valid: false,
    }
  }

  if (
    normalizedDeclaredMimeType &&
    extensionMimeType &&
    normalizedDeclaredMimeType !== extensionMimeType
  ) {
    return {
      code: 'mime-extension-mismatch',
      message: 'El tipo de imagen no coincide con su extensión.',
      valid: false,
    }
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      code: 'file-too-large',
      message: `Cada imagen debe pesar como máximo ${formatMegabytes(MAX_IMAGE_SIZE_BYTES)}.`,
      valid: false,
    }
  }

  const imagePixels =
    context.width !== undefined && context.height !== undefined
      ? getImagePixelCount(context.width, context.height)
      : 0
  if (imagePixels > MAX_IMAGE_PIXELS) {
    return {
      code: 'image-too-many-pixels',
      message: `Cada imagen puede tener como máximo ${formatMegapixels(MAX_IMAGE_PIXELS)}.`,
      valid: false,
    }
  }

  const existingCount = context.existingCount ?? context.existingFiles?.length ?? 0
  if (existingCount >= MAX_IMAGE_COUNT) {
    return {
      code: 'too-many-files',
      message: `Puedes cargar hasta ${MAX_IMAGE_COUNT} imágenes por documento.`,
      valid: false,
    }
  }

  const existingTotalBytes = context.existingTotalBytes ?? 0
  if (existingTotalBytes + file.size > MAX_TOTAL_IMAGE_SIZE_BYTES) {
    return {
      code: 'total-size-too-large',
      message: `El documento completo no puede superar ${formatMegabytes(MAX_TOTAL_IMAGE_SIZE_BYTES)}.`,
      valid: false,
    }
  }

  const existingTotalPixels = context.existingTotalPixels ?? 0
  if (
    imagePixels > 0 &&
    existingTotalPixels + imagePixels > MAX_TOTAL_IMAGE_PIXELS
  ) {
    return {
      code: 'total-pixels-too-large',
      message: `El documento completo no puede superar ${formatMegapixels(MAX_TOTAL_IMAGE_PIXELS)}.`,
      valid: false,
    }
  }

  const identity = getImageFileIdentity(file)
  if (
    context.existingFiles?.some(
      (existingFile) => getImageFileIdentity(existingFile) === identity,
    )
  ) {
    return {
      code: 'duplicate-file',
      message: 'Esta imagen ya está incluida en el documento.',
      valid: false,
    }
  }

  return { mimeType, valid: true }
}

export const rotateImage = (
  item: ImageDocumentItem,
): ImageDocumentItem => ({
  ...item,
  rotation: ((item.rotation + 90) % 360) as ImageDocumentItem['rotation'],
})

export const setImageFilter = (
  items: readonly ImageDocumentItem[],
  id: string,
  filter: ImageFilter,
) => items.map((item) => (item.id === id ? { ...item, filter } : item))

export const applyImageFilterToAll = (
  items: readonly ImageDocumentItem[],
  filter: ImageFilter,
) => items.map((item) => ({ ...item, filter }))

export const setScannerState = (
  items: readonly ImageDocumentItem[],
  id: string,
  scanner: ImageScannerState,
) => items.map((item) => (item.id === id ? { ...item, scanner } : item))

export const setScannerCorners = (
  items: readonly ImageDocumentItem[],
  id: string,
  corners: ScannerCorners,
) =>
  items.map((item) =>
    item.id === id
      ? {
          ...item,
          scanner: {
            ...item.scanner,
            active: item.scanner.active,
            corners,
            detected: false,
          },
        }
      : item,
  )

export const removeImage = (
  items: readonly ImageDocumentItem[],
  id: string,
) => items.filter((item) => item.id !== id)

export const moveImage = (
  items: readonly ImageDocumentItem[],
  fromIndex: number,
  toIndex: number,
) => {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return [...items]
  }

  const nextItems = [...items]
  const [movedItem] = nextItems.splice(fromIndex, 1)
  if (!movedItem) return nextItems
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}
