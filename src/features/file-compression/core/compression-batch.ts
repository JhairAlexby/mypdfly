import {
  CompressionJob,
} from './compression-job'
import { CompressionCoreError } from './errors'
import { DEFAULT_COMPRESSION_FORMATS } from './file-formats'
import {
  compressionProcessorRegistry,
  type CompressionProcessorRegistry,
} from './processor-registry'
import type {
  CompressionFormatDefinition,
  CompressionJobStartRequest,
  CompressionJobState,
} from './types'

export type CompressionBatchItemRequest = CompressionJobStartRequest & {
  readonly id: string
}

export type CompressionBatchTerminalState = Extract<
  CompressionJobState,
  { readonly status: 'cancelled' | 'error' | 'success' }
>

export type CompressionBatchItemOutcome = {
  readonly file: File
  readonly id: string
  readonly state: CompressionBatchTerminalState
}

export type CompressionBatchProgress = {
  readonly completed: number
  readonly currentItemId?: string
  readonly percentage: number
  readonly total: number
}

export type CompressionBatchContext = {
  readonly onItemState?: (
    itemId: string,
    state: CompressionJobState,
  ) => void
  readonly onProgress?: (progress: CompressionBatchProgress) => void
  readonly signal?: AbortSignal
}

const createCancelledState = (): CompressionBatchTerminalState => ({
  status: 'cancelled',
})

const assertValidItems = (
  items: readonly CompressionBatchItemRequest[],
) => {
  const ids = new Set<string>()

  for (const item of items) {
    if (!item.id.trim() || ids.has(item.id)) {
      throw new CompressionCoreError(
        'invalid-batch',
        'Cada archivo del lote debe tener un identificador único.',
      )
    }
    ids.add(item.id)
  }
}

const createProgress = (
  completed: number,
  total: number,
  currentItemId?: string,
): CompressionBatchProgress => ({
  completed,
  currentItemId,
  percentage: total ? Math.round((completed / total) * 100) : 100,
  total,
})

export const processCompressionBatch = async (
  items: readonly CompressionBatchItemRequest[],
  context: CompressionBatchContext = {},
  registry: CompressionProcessorRegistry = compressionProcessorRegistry,
  formats: readonly CompressionFormatDefinition[] = DEFAULT_COMPRESSION_FORMATS,
): Promise<CompressionBatchItemOutcome[]> => {
  assertValidItems(items)
  const outcomes: CompressionBatchItemOutcome[] = []
  const total = items.length
  let completed = 0
  context.onProgress?.(createProgress(0, total))

  for (const [index, item] of items.entries()) {
    if (context.signal?.aborted) {
      for (const remaining of items.slice(index)) {
        const state = createCancelledState()
        outcomes.push({ file: remaining.file, id: remaining.id, state })
        context.onItemState?.(remaining.id, state)
        completed += 1
        context.onProgress?.(createProgress(completed, total))
      }
      break
    }

    const job = new CompressionJob(registry, formats)
    const onAbort = () => job.cancel()
    const unsubscribe = job.subscribe(
      (state) => context.onItemState?.(item.id, state),
      false,
    )
    context.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      context.onProgress?.(
        createProgress(completed, total, item.id),
      )
      const state = await job.start({
        file: item.file,
        options: item.options,
        processorId: item.processorId,
      })

      if (
        state.status !== 'success' &&
        state.status !== 'error' &&
        state.status !== 'cancelled'
      ) {
        throw new CompressionCoreError(
          'processing-failed',
          'El archivo terminó en un estado inesperado.',
        )
      }

      outcomes.push({ file: item.file, id: item.id, state })
      completed += 1
      context.onProgress?.(createProgress(completed, total))
    } finally {
      context.signal?.removeEventListener('abort', onAbort)
      unsubscribe()
    }
  }

  return outcomes
}
