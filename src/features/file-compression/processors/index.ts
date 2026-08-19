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

export const registerImageCompressionProcessors = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
) => [
  registerJpegCompressionProcessor(registry),
  registerPngCompressionProcessor(registry),
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
export { optimizePngInWorker } from './png-optimizer'
export type { PngOptimiseOptions, PngOptimizer } from './png-optimizer'
export {
  inspectBrowserImageFile,
  type BrowserImageInspection,
} from './browser-image'
