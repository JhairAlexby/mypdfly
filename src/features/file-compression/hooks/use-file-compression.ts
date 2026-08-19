import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  CompressionCoreError,
  processCompressionBatch,
  validateCompressionFile,
  type CompressionBatchProgress,
  type CompressionJobState,
} from '@/features/file-compression/core'
import {
  AVIF_COMPRESSION_PROCESSOR_ID,
  DEFAULT_JPEG_COMPRESSION_QUALITY,
  DEFAULT_PNG_OPTIMIZATION_LEVEL,
  inspectBrowserImageFile,
  inspectModernImageFile,
  inspectPdfFile,
  JPEG_COMPRESSION_PROCESSOR_ID,
  PDF_COMPRESSION_PROCESSOR_ID,
  PNG_COMPRESSION_PROCESSOR_ID,
  registerFileCompressionProcessors,
  WEBP_COMPRESSION_PROCESSOR_ID,
} from '@/features/file-compression/processors'
import {
  createZipArchive,
  downloadBlob,
  isOperationCancelledError,
  raceWithAbort,
  throwIfAborted,
} from '@/lib/files'

export type SupportedCompressionFormat =
  | 'pdf'
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'avif'

export type CompressionFileItem = {
  readonly file: File
  readonly format: SupportedCompressionFormat
  readonly formatLabel: string
  readonly height?: number
  readonly id: string
  readonly pageCount?: number
  readonly previewUrl?: string
  readonly width?: number
}

export type CompressionSelectionIssue = {
  readonly fileName: string
  readonly id: string
  readonly message: string
}

export type CompressionArchiveState =
  | { readonly status: 'idle' }
  | {
      readonly completed: number
      readonly percentage: number
      readonly status: 'creating'
      readonly total: number
    }
  | { readonly message: string; readonly status: 'error' }

export type CompressionBatchStatus =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'cancelled'

const SUPPORTED_FORMATS = new Set<SupportedCompressionFormat>([
  'pdf',
  'jpeg',
  'png',
  'webp',
  'avif',
])

const EMPTY_BATCH_PROGRESS: CompressionBatchProgress = {
  completed: 0,
  percentage: 0,
  total: 0,
}

registerFileCompressionProcessors()

const isSupportedFormat = (
  format: string,
): format is SupportedCompressionFormat =>
  SUPPORTED_FORMATS.has(format as SupportedCompressionFormat)

const getSelectionErrorMessage = (error: unknown) => {
  if (error instanceof CompressionCoreError) return error.message
  if (error instanceof Error) return error.message

  return 'No se pudo inspeccionar el archivo seleccionado.'
}

const releasePreviews = (items: readonly CompressionFileItem[]) => {
  items.forEach((item) => {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
  })
}

const getProcessorId = (format: SupportedCompressionFormat) => {
  switch (format) {
    case 'pdf':
      return PDF_COMPRESSION_PROCESSOR_ID
    case 'jpeg':
      return JPEG_COMPRESSION_PROCESSOR_ID
    case 'png':
      return PNG_COMPRESSION_PROCESSOR_ID
    case 'webp':
      return WEBP_COMPRESSION_PROCESSOR_ID
    case 'avif':
      return AVIF_COMPRESSION_PROCESSOR_ID
  }
}

const inspectFile = async (
  file: File,
  signal: AbortSignal,
): Promise<Omit<CompressionFileItem, 'id'>> => {
  const validatedFile = await raceWithAbort(
    validateCompressionFile(file),
    signal,
  )
  throwIfAborted(signal)

  const format = validatedFile.format.id
  if (!isSupportedFormat(format)) {
    throw new CompressionCoreError(
      'unsupported-format',
      'Este formato todavía no tiene un procesador disponible.',
    )
  }

  if (format === 'pdf') {
    const inspection = await inspectPdfFile(file, signal)
    return {
      file,
      format,
      formatLabel: validatedFile.format.label,
      pageCount: inspection.pageCount,
    }
  }

  const inspection =
    format === 'webp' || format === 'avif'
      ? await inspectModernImageFile(file, format, signal)
      : await inspectBrowserImageFile(file, signal)
  throwIfAborted(signal)

  return {
    file,
    format,
    formatLabel: validatedFile.format.label,
    height: inspection.height,
    previewUrl: URL.createObjectURL(file),
    width: inspection.width,
  }
}

export const isLossyCompressionFormat = (
  format: SupportedCompressionFormat,
) => format === 'jpeg' || format === 'webp' || format === 'avif'

export const useFileCompression = () => {
  const [items, setItems] = useState<CompressionFileItem[]>([])
  const [issues, setIssues] = useState<CompressionSelectionIssue[]>([])
  const [isInspecting, setIsInspecting] = useState(false)
  const [itemStates, setItemStates] = useState<
    Readonly<Record<string, CompressionJobState>>
  >({})
  const [batchStatus, setBatchStatus] =
    useState<CompressionBatchStatus>('idle')
  const [batchProgress, setBatchProgress] =
    useState<CompressionBatchProgress>(EMPTY_BATCH_PROGRESS)
  const [quality, setQuality] = useState(
    Math.round(DEFAULT_JPEG_COMPRESSION_QUALITY * 100),
  )
  const [pngLevel, setPngLevel] = useState(
    DEFAULT_PNG_OPTIMIZATION_LEVEL,
  )
  const [archiveState, setArchiveState] =
    useState<CompressionArchiveState>({ status: 'idle' })
  const [generalError, setGeneralError] = useState<string | null>(null)
  const itemsRef = useRef<CompressionFileItem[]>([])
  const inspectionControllerRef = useRef<AbortController | null>(null)
  const batchControllerRef = useRef<AbortController | null>(null)
  const archiveControllerRef = useRef<AbortController | null>(null)
  const inspectionRunIdRef = useRef(0)
  const nextItemIdRef = useRef(1)

  const replaceItems = useCallback((nextItems: CompressionFileItem[]) => {
    itemsRef.current = nextItems
    setItems(nextItems)
  }, [])

  const selectFiles = useCallback(
    async (selectedFiles: readonly File[], append = false) => {
      if (
        !selectedFiles.length ||
        batchControllerRef.current ||
        archiveControllerRef.current
      ) {
        return
      }

      const runId = inspectionRunIdRef.current + 1
      const controller = new AbortController()
      inspectionRunIdRef.current = runId
      inspectionControllerRef.current?.abort()
      inspectionControllerRef.current = controller
      setIsInspecting(true)
      setGeneralError(null)
      setArchiveState({ status: 'idle' })

      if (!append) {
        releasePreviews(itemsRef.current)
        replaceItems([])
        setIssues([])
        setItemStates({})
        setBatchStatus('idle')
        setBatchProgress(EMPTY_BATCH_PROGRESS)
      }

      const inspectedItems: CompressionFileItem[] = []
      const nextIssues: CompressionSelectionIssue[] = []

      for (const file of selectedFiles) {
        try {
          const inspectedFile = await inspectFile(file, controller.signal)
          throwIfAborted(controller.signal)
          inspectedItems.push({
            ...inspectedFile,
            id: `compression-file-${nextItemIdRef.current++}`,
          })
        } catch (error) {
          if (isOperationCancelledError(error)) {
            releasePreviews(inspectedItems)
            if (inspectionControllerRef.current === controller) {
              inspectionControllerRef.current = null
              setIsInspecting(false)
            }
            return
          }

          nextIssues.push({
            fileName: file.name,
            id: `selection-issue-${nextItemIdRef.current++}`,
            message: getSelectionErrorMessage(error),
          })
        }
      }

      if (
        controller.signal.aborted ||
        inspectionRunIdRef.current !== runId
      ) {
        releasePreviews(inspectedItems)
        if (inspectionControllerRef.current === controller) {
          inspectionControllerRef.current = null
          setIsInspecting(false)
        }
        return
      }

      replaceItems(
        append
          ? [...itemsRef.current, ...inspectedItems]
          : inspectedItems,
      )
      setIssues((currentIssues) =>
        append ? [...currentIssues, ...nextIssues] : nextIssues,
      )
      setItemStates({})
      setBatchStatus('idle')
      setBatchProgress(EMPTY_BATCH_PROGRESS)
      if (inspectionControllerRef.current === controller) {
        inspectionControllerRef.current = null
        setIsInspecting(false)
      }
    },
    [replaceItems],
  )

  const removeItem = useCallback(
    (itemId: string) => {
      if (batchControllerRef.current || archiveControllerRef.current) return

      const removedItem = itemsRef.current.find((item) => item.id === itemId)
      if (removedItem?.previewUrl) {
        URL.revokeObjectURL(removedItem.previewUrl)
      }
      replaceItems(itemsRef.current.filter((item) => item.id !== itemId))
      setItemStates((currentStates) => {
        const nextStates = { ...currentStates }
        delete nextStates[itemId]
        return nextStates
      })
      setBatchStatus('idle')
      setBatchProgress(EMPTY_BATCH_PROGRESS)
      setArchiveState({ status: 'idle' })
    },
    [replaceItems],
  )

  const dismissIssue = useCallback((issueId: string) => {
    setIssues((currentIssues) =>
      currentIssues.filter((issue) => issue.id !== issueId),
    )
  }, [])

  const clearSelection = useCallback(() => {
    if (batchControllerRef.current || archiveControllerRef.current) return

    inspectionRunIdRef.current += 1
    inspectionControllerRef.current?.abort()
    inspectionControllerRef.current = null
    releasePreviews(itemsRef.current)
    replaceItems([])
    setIssues([])
    setIsInspecting(false)
    setItemStates({})
    setBatchStatus('idle')
    setBatchProgress(EMPTY_BATCH_PROGRESS)
    setArchiveState({ status: 'idle' })
    setGeneralError(null)
  }, [replaceItems])

  const compress = useCallback(async () => {
    if (
      !itemsRef.current.length ||
      batchControllerRef.current ||
      archiveControllerRef.current ||
      inspectionControllerRef.current
    ) {
      return
    }

    const controller = new AbortController()
    batchControllerRef.current = controller
    setItemStates({})
    setBatchStatus('processing')
    setBatchProgress({
      completed: 0,
      percentage: 0,
      total: itemsRef.current.length,
    })
    setArchiveState({ status: 'idle' })
    setGeneralError(null)

    try {
      await processCompressionBatch(
        itemsRef.current.map((item) => ({
          file: item.file,
          id: item.id,
          options:
            item.format === 'png'
              ? { level: pngLevel }
              : isLossyCompressionFormat(item.format)
                ? { quality: quality / 100 }
                : {},
          processorId: getProcessorId(item.format),
        })),
        {
          onItemState: (itemId, state) => {
            setItemStates((currentStates) => ({
              ...currentStates,
              [itemId]: state,
            }))
          },
          onProgress: setBatchProgress,
          signal: controller.signal,
        },
      )
      setBatchStatus(controller.signal.aborted ? 'cancelled' : 'completed')
    } catch (error) {
      if (isOperationCancelledError(error) || controller.signal.aborted) {
        setBatchStatus('cancelled')
      } else {
        setBatchStatus('idle')
        setGeneralError(
          error instanceof Error
            ? error.message
            : 'No se pudo procesar el lote.',
        )
      }
    } finally {
      if (batchControllerRef.current === controller) {
        batchControllerRef.current = null
      }
    }
  }, [pngLevel, quality])

  const successfulResults = useMemo(
    () =>
      items.flatMap((item) => {
        const state = itemStates[item.id]
        return state?.status === 'success'
          ? [{ id: item.id, result: state.result }]
          : []
      }),
    [itemStates, items],
  )

  const downloadResult = useCallback(
    (itemId: string) => {
      const state = itemStates[itemId]
      if (state?.status !== 'success') return
      downloadBlob(state.result.output, state.result.outputFileName)
    },
    [itemStates],
  )

  const downloadAll = useCallback(async () => {
    if (
      !successfulResults.length ||
      batchControllerRef.current ||
      archiveControllerRef.current
    ) {
      return
    }

    if (successfulResults.length === 1) {
      const [{ result }] = successfulResults
      downloadBlob(result.output, result.outputFileName)
      return
    }

    const controller = new AbortController()
    archiveControllerRef.current = controller
    setArchiveState({
      completed: 0,
      percentage: 0,
      status: 'creating',
      total: successfulResults.length,
    })

    try {
      const archive = await createZipArchive(
        successfulResults.map(({ result }) => ({
          blob: result.output,
          fileName: result.outputFileName,
        })),
        {
          onProgress: (completed, total) => {
            setArchiveState({
              completed,
              percentage: Math.round((completed / total) * 100),
              status: 'creating',
              total,
            })
          },
          signal: controller.signal,
        },
      )
      throwIfAborted(controller.signal)
      downloadBlob(archive, 'archivos-comprimidos.zip')
      setArchiveState({ status: 'idle' })
    } catch (error) {
      setArchiveState(
        isOperationCancelledError(error) || controller.signal.aborted
          ? { status: 'idle' }
          : {
              message:
                error instanceof Error
                  ? error.message
                  : 'No se pudo crear el archivo ZIP.',
              status: 'error',
            },
      )
    } finally {
      if (archiveControllerRef.current === controller) {
        archiveControllerRef.current = null
      }
    }
  }, [successfulResults])

  useEffect(
    () => () => {
      inspectionRunIdRef.current += 1
      inspectionControllerRef.current?.abort()
      batchControllerRef.current?.abort()
      archiveControllerRef.current?.abort()
      releasePreviews(itemsRef.current)
    },
    [],
  )

  return {
    archiveState,
    batchProgress,
    batchStatus,
    cancelArchive: () => archiveControllerRef.current?.abort(),
    cancelBatch: () => batchControllerRef.current?.abort(),
    clearSelection,
    compress,
    dismissIssue,
    downloadAll,
    downloadResult,
    generalError,
    isInspecting,
    issues,
    itemStates,
    items,
    pngLevel,
    quality,
    removeItem,
    selectFiles,
    setPngLevel,
    setQuality,
    successfulCount: successfulResults.length,
  }
}
