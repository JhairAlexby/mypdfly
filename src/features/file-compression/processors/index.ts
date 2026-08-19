import {
  compressionProcessorRegistry,
  type CompressionProcessor,
  type CompressionProcessorRegistry,
} from '@/features/file-compression/core'
import {
  jpegCompressionProcessor,
  JPEG_COMPRESSION_PROCESSOR_ID,
} from './jpeg-processor'

export const registerJpegCompressionProcessor = (
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
): CompressionProcessor => {
  const registeredProcessor = registry.get(JPEG_COMPRESSION_PROCESSOR_ID)

  if (registeredProcessor) return registeredProcessor

  registry.register(jpegCompressionProcessor)
  return jpegCompressionProcessor
}

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
