import {
  isOperationCancelledError,
  raceWithAbort,
  throwIfAborted,
} from '@/lib/files/cancellation'
import { CompressionCoreError } from './errors'
import { DEFAULT_COMPRESSION_FORMATS } from './file-formats'
import { validateCompressionFile } from './file-validation'
import {
  compressionProcessorRegistry,
  CompressionProcessorRegistry,
} from './processor-registry'
import type {
  CompressionFormatDefinition,
  CompressionJobError,
  CompressionJobListener,
  CompressionJobStartRequest,
  CompressionJobState,
  CompressionProcessorOutput,
  CompressionProgress,
  CompressionProgressUpdate,
  CompressionResult,
  ValidatedCompressionFile,
} from './types'

const createInitialProgress = (): CompressionProgress => ({
  completed: 0,
  percentage: 0,
  phase: 'preparing',
  total: 1,
})

const normalizeProgress = (
  update: CompressionProgressUpdate,
): CompressionProgress => {
  const finiteTotal = Number.isFinite(update.total) ? update.total : 1
  const total = Math.max(1, finiteTotal)
  const finiteCompleted = Number.isFinite(update.completed)
    ? update.completed
    : 0
  const completed = Math.min(total, Math.max(0, finiteCompleted))

  return {
    ...update,
    completed,
    percentage: Math.round((completed / total) * 100),
    total,
  }
}

const normalizeError = (error: unknown): CompressionJobError => {
  if (error instanceof CompressionCoreError) {
    return { code: error.code, message: error.message }
  }

  return {
    code: 'processing-failed',
    message:
      error instanceof Error
        ? error.message
        : 'No se pudo completar la compresión.',
  }
}

const createResult = (
  input: ValidatedCompressionFile,
  processorId: string,
  output: CompressionProcessorOutput,
): CompressionResult => {
  if (
    !output.fileName.trim() ||
    !(output.blob instanceof Blob) ||
    output.blob.size <= 0
  ) {
    throw new CompressionCoreError(
      'invalid-processor-output',
      `El procesador ${processorId} devolvió un resultado inválido.`,
    )
  }

  const originalSize = input.file.size
  const outputSize = output.blob.size
  const bytesSaved = originalSize - outputSize
  const reductionPercentage = originalSize
    ? (bytesSaved / originalSize) * 100
    : 0

  return {
    bytesSaved,
    isSmaller: outputSize < originalSize,
    metadata: output.metadata ?? {},
    originalSize,
    output: output.blob,
    outputFileName: output.fileName,
    outputMimeType: output.blob.type || input.detectedMimeType,
    outputSize,
    processorId,
    reductionPercentage,
    warnings: [...input.warnings, ...(output.warnings ?? [])],
  }
}

export class CompressionJob {
  readonly #formats: readonly CompressionFormatDefinition[]
  readonly #listeners = new Set<CompressionJobListener>()
  readonly #registry: CompressionProcessorRegistry
  #abortController: AbortController | null = null
  #runId = 0
  #state: CompressionJobState = { status: 'idle' }

  constructor(
    registry = compressionProcessorRegistry,
    formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
  ) {
    this.#registry = registry
    this.#formats = formats
  }

  get state() {
    return this.#state
  }

  get isActive() {
    return this.#abortController !== null
  }

  subscribe(listener: CompressionJobListener, emitCurrentState = true) {
    this.#listeners.add(listener)
    if (emitCurrentState) listener(this.#state)

    return () => this.#listeners.delete(listener)
  }

  cancel() {
    if (!this.#abortController) return false
    this.#abortController.abort()
    return true
  }

  reset() {
    if (this.isActive) {
      throw new CompressionCoreError(
        'job-active',
        'No se puede reiniciar un trabajo mientras está activo.',
      )
    }

    this.#setState({ status: 'idle' })
  }

  async start({
    file,
    options = {},
    processorId,
  }: CompressionJobStartRequest): Promise<CompressionJobState> {
    if (this.isActive) {
      throw new CompressionCoreError(
        'job-active',
        'Ya existe un trabajo de compresión activo.',
      )
    }

    const runId = this.#runId + 1
    const controller = new AbortController()
    let acceptsProgress = false
    let input: ValidatedCompressionFile | undefined
    let terminalState: CompressionJobState
    this.#runId = runId
    this.#abortController = controller
    this.#setState({ file, status: 'validating' })

    try {
      input = await raceWithAbort(
        validateCompressionFile(file, this.#formats),
        controller.signal,
      )
      throwIfAborted(controller.signal)

      const processor = this.#registry.resolve(input.format.id, processorId)
      const validatedInput = input
      this.#setState({
        input: validatedInput,
        processorId: processor.id,
        status: 'ready',
      })
      this.#setState({
        input: validatedInput,
        processorId: processor.id,
        progress: createInitialProgress(),
        status: 'processing',
      })

      acceptsProgress = true
      const reportProgress = (update: CompressionProgressUpdate) => {
        if (
          !acceptsProgress ||
          this.#runId !== runId ||
          controller.signal.aborted
        ) {
          return
        }

        this.#setState({
          input: validatedInput,
          processorId: processor.id,
          progress: normalizeProgress(update),
          status: 'processing',
        })
      }
      const output = await raceWithAbort(
        processor.compress(validatedInput, options, {
          reportProgress,
          signal: controller.signal,
        }),
        controller.signal,
      )
      acceptsProgress = false
      throwIfAborted(controller.signal)

      const result = createResult(validatedInput, processor.id, output)
      terminalState = { input: validatedInput, result, status: 'success' }
    } catch (error) {
      if (
        controller.signal.aborted ||
        isOperationCancelledError(error)
      ) {
        terminalState = { input, status: 'cancelled' }
      } else {
        terminalState = {
          error: normalizeError(error),
          input,
          status: 'error',
        }
      }
    } finally {
      acceptsProgress = false
      if (this.#runId === runId) this.#abortController = null
    }

    this.#setState(terminalState)
    return this.#state
  }

  #setState(state: CompressionJobState) {
    this.#state = state
    this.#listeners.forEach((listener) => listener(state))
  }
}
