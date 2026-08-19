import {
  CompressionCoreError,
  type CompressionOptions,
  type CompressionProcessor,
} from '@/features/file-compression/core'
import { getSafeFileBaseName, throwIfAborted } from '@/lib/files'
import {
  optimizePngInWorker,
  type PngOptimizer,
} from './png-optimizer'

export const PNG_COMPRESSION_PROCESSOR_ID = 'png-oxipng-wasm'
export const DEFAULT_PNG_OPTIMIZATION_LEVEL = 3
export const MINIMUM_PNG_OPTIMIZATION_LEVEL = 1
export const MAXIMUM_PNG_OPTIMIZATION_LEVEL = 4

export type PngProcessorDependencies = {
  readonly optimize: PngOptimizer
}

const PNG_SIGNATURE = [
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
] as const

const browserDependencies: PngProcessorDependencies = {
  optimize: optimizePngInWorker,
}

const normalizeLevel = (options: CompressionOptions) => {
  const requestedLevel = options.level

  if (
    typeof requestedLevel !== 'number' ||
    !Number.isFinite(requestedLevel)
  ) {
    return DEFAULT_PNG_OPTIMIZATION_LEVEL
  }

  return Math.round(
    Math.min(
      MAXIMUM_PNG_OPTIMIZATION_LEVEL,
      Math.max(MINIMUM_PNG_OPTIMIZATION_LEVEL, requestedLevel),
    ),
  )
}

const hasPngSignature = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer, 0, PNG_SIGNATURE.length)

  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

export const createPngCompressionProcessor = (
  dependencies: PngProcessorDependencies = browserDependencies,
): CompressionProcessor => ({
  id: PNG_COMPRESSION_PROCESSOR_ID,
  label: 'Optimizador PNG OxiPNG WASM',
  formatIds: ['png'],
  compress: async (input, options, context) => {
    const level = normalizeLevel(options)

    context.reportProgress({
      completed: 0,
      message: 'Preparando PNG…',
      phase: 'preparing',
      total: 3,
    })
    throwIfAborted(context.signal)

    const inputBuffer = await input.file.arrayBuffer()
    throwIfAborted(context.signal)
    context.reportProgress({
      completed: 1,
      message: 'Cargando OxiPNG WASM…',
      phase: 'preparing',
      total: 3,
    })
    context.reportProgress({
      completed: 2,
      message: 'Optimizando PNG sin pérdida…',
      phase: 'compressing',
      total: 3,
    })

    const optimizedBuffer = await dependencies.optimize(
      inputBuffer,
      { level },
      context.signal,
    )
    throwIfAborted(context.signal)

    if (
      optimizedBuffer.byteLength <= PNG_SIGNATURE.length ||
      !hasPngSignature(optimizedBuffer)
    ) {
      throw new CompressionCoreError(
        'invalid-processor-output',
        'OxiPNG devolvió un archivo PNG inválido.',
      )
    }

    const usedOriginal = optimizedBuffer.byteLength >= input.file.size
    const blob = usedOriginal
      ? new Blob([input.file], { type: 'image/png' })
      : new Blob([optimizedBuffer], { type: 'image/png' })

    context.reportProgress({
      completed: 3,
      message: 'PNG listo',
      phase: 'finalizing',
      total: 3,
    })

    return {
      blob,
      fileName: `${getSafeFileBaseName(input.file.name)}-comprimido.png`,
      metadata: {
        level,
        lossless: true,
        optimizer: 'OxiPNG WASM',
        preservesTransparency: true,
        usedOriginal,
      },
      warnings: usedOriginal
        ? [
            'El PNG ya estaba optimizado; se conservaron sus bytes originales.',
          ]
        : [],
    }
  },
})

export const pngCompressionProcessor = createPngCompressionProcessor()
