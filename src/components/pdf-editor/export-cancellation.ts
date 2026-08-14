export class ExportCancelledError extends Error {
  constructor() {
    super('La exportación fue cancelada.')
    this.name = 'ExportCancelledError'
  }
}

export const throwIfExportAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new ExportCancelledError()
}

export const isExportCancelledError = (error: unknown) =>
  error instanceof ExportCancelledError
