import {
  OperationCancelledError,
  throwIfAborted,
} from '@/lib/files/cancellation'

export class ExportCancelledError extends OperationCancelledError {
  constructor() {
    super('La exportación fue cancelada.')
    this.name = 'ExportCancelledError'
  }
}

export const throwIfExportAborted = (signal?: AbortSignal) =>
  throwIfAborted(signal, () => new ExportCancelledError())

export const isExportCancelledError = (error: unknown) =>
  error instanceof ExportCancelledError
