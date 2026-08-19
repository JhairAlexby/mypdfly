import {
  compressionProcessorRegistry,
  type CompressionProcessor,
  type CompressionProcessorRegistry,
} from '@/features/file-compression/core'
import {
  jpegCompressionProcessor,
  JPEG_COMPRESSION_PROCESSOR_ID,
} from './jpeg-processor'
import {
  pngCompressionProcessor,
  PNG_COMPRESSION_PROCESSOR_ID,
} from './png-processor'
import {
  pdfCompressionProcessor,
  PDF_COMPRESSION_PROCESSOR_ID,
} from './pdf-processor'
import {
  avifCompressionProcessor,
  AVIF_COMPRESSION_PROCESSOR_ID,
  webpCompressionProcessor,
  WEBP_COMPRESSION_PROCESSOR_ID,
} from './modern-image-processor'

export const registerJpegCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(JPEG_COMPRESSION_PROCESSOR_ID)

  if (registeredProcessor) return registeredProcessor

  registry.register(jpegCompressionProcessor)
  return jpegCompressionProcessor
}

export const registerPngCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(PNG_COMPRESSION_PROCESSOR_ID)

  if (registeredProcessor) return registeredProcessor

  registry.register(pngCompressionProcessor)
  return pngCompressionProcessor
}

export const registerPdfCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(PDF_COMPRESSION_PROCESSOR_ID)

  if (registeredProcessor) return registeredProcessor

  registry.register(pdfCompressionProcessor)
  return pdfCompressionProcessor
}

export const registerWebpCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(WEBP_COMPRESSION_PROCESSOR_ID)
  if (registeredProcessor) return registeredProcessor

  registry.register(webpCompressionProcessor)
  return webpCompressionProcessor
}

export const registerAvifCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(AVIF_COMPRESSION_PROCESSOR_ID)
  if (registeredProcessor) return registeredProcessor

  registry.register(avifCompressionProcessor)
  return avifCompressionProcessor
}

export const registerImageCompressionProcessors = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
) => [
  registerJpegCompressionProcessor(registry),
  registerPngCompressionProcessor(registry),
  registerWebpCompressionProcessor(registry),
  registerAvifCompressionProcessor(registry),
]

export const registerFileCompressionProcessors = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
) => [
  ...registerImageCompressionProcessors(registry),
  registerPdfCompressionProcessor(registry),
]

export {
  createJpegCompressionProcessor,
  DEFAULT_JPEG_COMPRESSION_QUALITY,
  inspectJpegFile,
  jpegCompressionProcessor,
  JPEG_COMPRESSION_PROCESSOR_ID,
  MINIMUM_JPEG_COMPRESSION_QUALITY,
} from './jpeg-processor'
export type {
  DecodedJpegImage,
  JpegInspection,
  JpegProcessorDependencies,
} from './jpeg-processor'
export {
  createPngCompressionProcessor,
  DEFAULT_PNG_OPTIMIZATION_LEVEL,
  MAXIMUM_PNG_OPTIMIZATION_LEVEL,
  MINIMUM_PNG_OPTIMIZATION_LEVEL,
  pngCompressionProcessor,
  PNG_COMPRESSION_PROCESSOR_ID,
} from './png-processor'
export type { PngProcessorDependencies } from './png-processor'
export {
  avifCompressionProcessor,
  AVIF_COMPRESSION_PROCESSOR_ID,
  createModernImageCompressionProcessor,
  DEFAULT_MODERN_IMAGE_QUALITY,
  inspectModernImageFile,
  MINIMUM_MODERN_IMAGE_QUALITY,
  webpCompressionProcessor,
  WEBP_COMPRESSION_PROCESSOR_ID,
} from './modern-image-processor'
export type {
  ModernImageInspection,
  ModernImageProcessorDependencies,
} from './modern-image-processor'
export type {
  ModernImageCodec,
  ModernImageCodecOptions,
  ModernImageCodecResult,
  ModernImageFormat,
} from './modern-image-codec'
export {
  createPdfCompressionProcessor,
  inspectPdfFile,
  pdfCompressionProcessor,
  PDF_COMPRESSION_PROCESSOR_ID,
} from './pdf-processor'
export type {
  PdfDocumentInspection,
  PdfProcessorDependencies,
} from './pdf-processor'
export type {
  PdfCodec,
  PdfCodecOptions,
  PdfCodecResult,
} from './pdf-codec'
export { optimizePngInWorker } from './png-optimizer'
export type { PngOptimiseOptions, PngOptimizer } from './png-optimizer'
export {
  inspectBrowserImageFile,
  type BrowserImageInspection,
} from './browser-image'
