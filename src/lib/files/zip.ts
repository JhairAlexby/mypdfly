import { Zip, ZipPassThrough } from 'fflate'

import {
  OperationCancelledError,
  throwIfAborted,
  type CancellationErrorFactory,
} from './cancellation'
import {
  getFileExtension,
  removeFileExtension,
  sanitizeFileNamePart,
} from './file-names'

export type ZipBlobEntry = {
  readonly blob: Blob
  readonly fileName: string
}

export type ZipArchiveOptions = {
  readonly createCancellationError?: CancellationErrorFactory
  readonly onProgress?: (completed: number, total: number) => void
  readonly signal?: AbortSignal
}

const createDefaultCancellationError = () =>
  new OperationCancelledError()

export const getUniqueArchiveFileNames = (
  fileNames: readonly string[],
) => {
  const counts = new Map<string, number>()

  return fileNames.map((fileName) => {
    const safeName = sanitizeFileNamePart(fileName) || 'archivo'
    const normalizedName = safeName.toLocaleLowerCase('es-MX')
    const count = (counts.get(normalizedName) ?? 0) + 1
    counts.set(normalizedName, count)

    if (count === 1) return safeName

    const extension = getFileExtension(safeName)
    const baseName = removeFileExtension(safeName)
    return extension
      ? `${baseName} (${count}).${extension}`
      : `${baseName} (${count})`
  })
}

export const createZipArchive = (
  entries: readonly ZipBlobEntry[],
  options: ZipArchiveOptions = {},
) => {
  if (!entries.length) {
    return Promise.reject(
      new Error('No hay archivos para incluir en el ZIP.'),
    )
  }

  const createCancellationError =
    options.createCancellationError ?? createDefaultCancellationError
  const fileNames = getUniqueArchiveFileNames(
    entries.map((entry) => entry.fileName),
  )

  return new Promise<Blob>((resolve, reject) => {
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let settled = false
    const chunks: ArrayBuffer[] = []
    const archive = new Zip((error, chunk, final) => {
      if (settled) return
      if (error) {
        finish(() => reject(error))
        return
      }

      if (chunk.length) chunks.push(Uint8Array.from(chunk).buffer)
      if (final) {
        finish(() =>
          resolve(new Blob(chunks, { type: 'application/zip' })),
        )
      }
    })

    const cleanup = () =>
      options.signal?.removeEventListener('abort', onAbort)
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      callback()
    }
    const onAbort = () => {
      void activeReader?.cancel()
      archive.terminate()
      finish(() => reject(createCancellationError()))
    }

    const feedArchive = async () => {
      try {
        throwIfAborted(options.signal, createCancellationError)
        options.signal?.addEventListener('abort', onAbort, { once: true })

        for (const [index, entry] of entries.entries()) {
          throwIfAborted(options.signal, createCancellationError)
          const zipEntry = new ZipPassThrough(fileNames[index])
          archive.add(zipEntry)
          activeReader = entry.blob.stream().getReader()

          try {
            while (true) {
              const { done, value } = await activeReader.read()
              throwIfAborted(options.signal, createCancellationError)
              if (done) break
              zipEntry.push(value)
            }
            zipEntry.push(new Uint8Array(), true)
          } finally {
            activeReader.releaseLock()
            activeReader = null
          }

          options.onProgress?.(index + 1, entries.length)
        }

        throwIfAborted(options.signal, createCancellationError)
        archive.end()
      } catch (error) {
        archive.terminate()
        finish(() => reject(error))
      }
    }

    void feedArchive()
  })
}
