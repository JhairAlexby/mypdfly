import { CompressionCoreError } from './errors'
import { DEFAULT_COMPRESSION_FORMATS } from './file-formats'
import type {
  CompressionFormatDefinition,
  CompressionProcessor,
} from './types'

export class CompressionProcessorRegistry {
  readonly #knownFormatIds: ReadonlySet<string>
  readonly #processors = new Map<string, CompressionProcessor>()

  constructor(
    formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
  ) {
    this.#knownFormatIds = new Set(formats.map((format) => format.id))
  }

  register(processor: CompressionProcessor) {
    const id = processor.id.trim()

    if (
      !id ||
      processor.id !== id ||
      !processor.label.trim() ||
      !processor.formatIds.length ||
      typeof processor.compress !== 'function'
    ) {
      throw new CompressionCoreError(
        'invalid-processor',
        'El procesador debe tener identificador, nombre y al menos un formato.',
      )
    }

    if (this.#processors.has(id)) {
      throw new CompressionCoreError(
        'duplicate-processor',
        `Ya existe un procesador registrado con el identificador ${id}.`,
      )
    }

    const unknownFormat = processor.formatIds.find(
      (formatId) => !this.#knownFormatIds.has(formatId),
    )

    if (unknownFormat) {
      throw new CompressionCoreError(
        'unsupported-format',
        `El procesador ${id} declara el formato desconocido ${unknownFormat}.`,
      )
    }

    this.#processors.set(id, processor)
  }

  unregister(processorId: string) {
    return this.#processors.delete(processorId)
  }

  get(processorId: string) {
    return this.#processors.get(processorId)
  }

  list() {
    return [...this.#processors.values()]
  }

  findCompatible(formatId: string) {
    return this.list().filter((processor) =>
      processor.formatIds.includes(formatId),
    )
  }

  resolve(formatId: string, processorId?: string) {
    if (processorId) {
      const processor = this.get(processorId)

      if (!processor) {
        throw new CompressionCoreError(
          'processor-not-found',
          `No existe el procesador ${processorId}.`,
        )
      }

      if (!processor.formatIds.includes(formatId)) {
        throw new CompressionCoreError(
          'processor-incompatible',
          `El procesador ${processorId} no admite el formato ${formatId}.`,
        )
      }

      return processor
    }

    const processor = this.findCompatible(formatId)[0]

    if (!processor) {
      throw new CompressionCoreError(
        'processor-not-found',
        `Todavía no hay un procesador disponible para el formato ${formatId}.`,
      )
    }

    return processor
  }
}

export const compressionProcessorRegistry =
  new CompressionProcessorRegistry()
