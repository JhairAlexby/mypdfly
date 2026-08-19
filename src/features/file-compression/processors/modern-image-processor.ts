import {
  CompressionCoreError,
  findFormatById,
  hasIsoBmffFileTypeBrand,
  type CompressionOptions,
  type CompressionProcessor,
} from '@/features/file-compression/core'
import { getSafeFileBaseName, throwIfAborted } from '@/lib/files'
import {
  processModernImageInWorker,
  type ModernImageCodec,
  type ModernImageFormat,
} from './modern-image-codec'

export const WEBP_COMPRESSION_PROCESSOR_ID = 'webp-wasm'
export const AVIF_COMPRESSION_PROCESSOR_ID = 'avif-wasm'
export const DEFAULT_MODERN_IMAGE_QUALITY = 80
export const MINIMUM_MODERN_IMAGE_QUALITY = 10

export type ModernImageInspection = {
  readonly height: number
  readonly width: number
}

export type ModernImageProcessorDependencies = {
  readonly process: ModernImageCodec
}

const browserDependencies: ModernImageProcessorDependencies = {
  process: processModernImageInWorker,
}

const readAscii = (
  bytes: Uint8Array,
  offset: number,
  length: number,
) => String.fromCharCode(...bytes.slice(offset, offset + length))

const assertStaticModernImage = (
  bytes: Uint8Array,
  format: ModernImageFormat,
) => {
  if (format === 'webp') {
    for (let offset = 12; offset + 8 <= bytes.length; ) {
      const chunkType = readAscii(bytes, offset, 4)
      const chunkSize =
        bytes[offset + 4] |
        (bytes[offset + 5] << 8) |
        (bytes[offset + 6] << 16) |
        (bytes[offset + 7] << 24)

      if (chunkType === 'ANIM') {
        throw new CompressionCoreError(
          'unsupported-format',
          'Los WebP animados todavía no se pueden recomprimir sin perder fotogramas.',
        )
      }

      if (
        chunkType === 'VP8X' &&
        offset + 8 < bytes.length &&
        (bytes[offset + 8] & 0x02) !== 0
      ) {
        throw new CompressionCoreError(
          'unsupported-format',
          'Los WebP animados todavía no se pueden recomprimir sin perder fotogramas.',
        )
      }

      if (chunkSize < 0) break
      offset += 8 + chunkSize + (chunkSize % 2)
    }
    return
  }

  if (hasIsoBmffFileTypeBrand(bytes, 'avis')) {
    throw new CompressionCoreError(
      'unsupported-format',
      'Las secuencias AVIF animadas todavía no se pueden recomprimir.',
    )
  }
}

const normalizeQuality = (options: CompressionOptions) => {
  const requestedQuality = options.quality
  if (
    typeof requestedQuality !== 'number' ||
    !Number.isFinite(requestedQuality)
  ) {
    return DEFAULT_MODERN_IMAGE_QUALITY
  }

  const percentage = requestedQuality <= 1
    ? requestedQuality * 100
    : requestedQuality

  return Math.round(
    Math.min(100, Math.max(MINIMUM_MODERN_IMAGE_QUALITY, percentage)),
  )
}

const getFormatDetails = (format: ModernImageFormat) => ({
  extension: format,
  label: format === 'webp' ? 'WebP' : 'AVIF',
  mimeType: format === 'webp' ? 'image/webp' : 'image/avif',
  processorId:
    format === 'webp'
      ? WEBP_COMPRESSION_PROCESSOR_ID
      : AVIF_COMPRESSION_PROCESSOR_ID,
})

const getValidatedBytes = async (
  file: File,
  format: ModernImageFormat,
  signal?: AbortSignal,
) => {
  throwIfAborted(signal)
  const input = await file.arrayBuffer()
  throwIfAborted(signal)
  const bytes = new Uint8Array(input)
  assertStaticModernImage(bytes, format)
  return input
}

export const inspectModernImageFile = async (
  file: File,
  format: ModernImageFormat,
  signal?: AbortSignal,
  dependencies: ModernImageProcessorDependencies = browserDependencies,
): Promise<ModernImageInspection> => {
  const input = await getValidatedBytes(file, format, signal)
  const result = await dependencies.process(
    input,
    {
      format,
      mode: 'inspect',
      quality: DEFAULT_MODERN_IMAGE_QUALITY,
    },
    signal,
  )
  throwIfAborted(signal)

  return { height: result.height, width: result.width }
}

export const createModernImageCompressionProcessor = (
  format: ModernImageFormat,
  dependencies: ModernImageProcessorDependencies = browserDependencies,
): CompressionProcessor => {
  const details = getFormatDetails(format)

  return {
    id: details.processorId,
    label: `Compresor ${details.label} WASM`,
    formatIds: [format],
    compress: async (input, options, context) => {
      const quality = normalizeQuality(options)
      context.reportProgress({
        completed: 0,
        message: `Preparando ${details.label}…`,
        phase: 'preparing',
        total: 3,
      })
      const inputBuffer = await getValidatedBytes(
        input.file,
        format,
        context.signal,
      )
      context.reportProgress({
        completed: 1,
        message: 'Imagen decodificada',
        phase: 'preparing',
        total: 3,
      })
      context.reportProgress({
        completed: 2,
        message: `Comprimiendo ${details.label}…`,
        phase: 'compressing',
        total: 3,
      })

      const result = await dependencies.process(
        inputBuffer,
        { format, mode: 'compress', quality },
        context.signal,
      )
      throwIfAborted(context.signal)

      if (!result.output) {
        throw new CompressionCoreError(
          'invalid-processor-output',
          `El codificador ${details.label} no devolvió ningún archivo.`,
        )
      }

      const outputFormat = findFormatById(format)
      if (
        !outputFormat ||
        !outputFormat.matchesSignature(new Uint8Array(result.output))
      ) {
        throw new CompressionCoreError(
          'invalid-processor-output',
          `El codificador devolvió un ${details.label} inválido.`,
        )
      }

      const usedOriginal = result.output.byteLength >= input.file.size
      const blob = usedOriginal
        ? new Blob([input.file], { type: details.mimeType })
        : new Blob([result.output], { type: details.mimeType })
      context.reportProgress({
        completed: 3,
        message: `${details.label} listo`,
        phase: 'finalizing',
        total: 3,
      })

      return {
        blob,
        fileName: `${getSafeFileBaseName(input.file.name)}-comprimido.${details.extension}`,
        metadata: {
          encoder:
            format === 'webp' ? 'libwebp WASM' : 'libavif WASM',
          height: result.height,
          preservesTransparency: true,
          quality,
          usedOriginal,
          width: result.width,
        },
        warnings: [
          'Los metadatos del archivo original no se conservan.',
          ...(usedOriginal
            ? [
                `El ${details.label} ya estaba optimizado; se conservaron sus bytes originales.`,
              ]
            : []),
        ],
      }
    },
  }
}

export const webpCompressionProcessor =
  createModernImageCompressionProcessor('webp')
export const avifCompressionProcessor =
  createModernImageCompressionProcessor('avif')
