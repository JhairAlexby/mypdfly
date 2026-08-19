export type CancellationErrorFactory = () => Error

export class OperationCancelledError extends Error {
  constructor(message = 'La operación fue cancelada.') {
    super(message)
    this.name = 'OperationCancelledError'
  }
}

const createDefaultCancellationError = () => new OperationCancelledError()

export const throwIfAborted = (
  signal?: AbortSignal,
  createError: CancellationErrorFactory = createDefaultCancellationError,
) => {
  if (signal?.aborted) throw createError()
}

export const isOperationCancelledError = (error: unknown) =>
  error instanceof OperationCancelledError ||
  (error instanceof Error && error.name === 'AbortError')

export const raceWithAbort = <Result>(
  operation: Promise<Result>,
  signal?: AbortSignal,
  createError: CancellationErrorFactory = createDefaultCancellationError,
) => {
  if (!signal) return operation

  return new Promise<Result>((resolve, reject) => {
    let settled = false

    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onAbort = () => finish(() => reject(createError()))

    operation.then(
      (result) => finish(() => resolve(result)),
      (error) => finish(() => reject(error)),
    )

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
