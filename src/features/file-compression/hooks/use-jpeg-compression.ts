import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CompressionCoreError,
  CompressionJob,
  validateCompressionFile,
} from '@/features/file-compression/core'
import {
  DEFAULT_JPEG_COMPRESSION_QUALITY,
  inspectJpegFile,
  JPEG_COMPRESSION_PROCESSOR_ID,
  registerJpegCompressionProcessor,
} from '@/features/file-compression/processors'
import {
  isOperationCancelledError,
  raceWithAbort,
  throwIfAborted,
} from '@/lib/files'
import { useCompressionJobState } from './use-compression-job-state'

export type JpegSelectionState =
  | { readonly status: 'empty' }
  | { readonly status: 'inspecting'; readonly file: File }
  | {
      readonly status: 'ready'
      readonly file: File
      readonly height: number
      readonly previewUrl: string
      readonly width: number
    }
  | { readonly status: 'error'; readonly message: string }

registerJpegCompressionProcessor()

const getSelectionErrorMessage = (error: unknown) => {
  if (error instanceof CompressionCoreError) return error.message
  if (error instanceof Error) return error.message

  return 'No se pudo inspeccionar la imagen seleccionada.'
}

export const useJpegCompression = () => {
  const [job] = useState(() => new CompressionJob())
  const jobState = useCompressionJobState(job)
  const [quality, setQuality] = useState(
    Math.round(DEFAULT_JPEG_COMPRESSION_QUALITY * 100),
  )
  const [selection, setSelection] = useState<JpegSelectionState>({
    status: 'empty',
  })
  const inspectionControllerRef = useRef<AbortController | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const selectionRunIdRef = useRef(0)

  const releasePreview = useCallback(() => {
    if (!previewUrlRef.current) return

    URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
  }, [])

  const selectFile = useCallback(
    async (file: File) => {
      if (job.isActive) return

      const runId = selectionRunIdRef.current + 1
      const controller = new AbortController()
      selectionRunIdRef.current = runId
      inspectionControllerRef.current?.abort()
      inspectionControllerRef.current = controller
      releasePreview()

      if (job.state.status !== 'idle') job.reset()
      setSelection({ file, status: 'inspecting' })

      try {
        const validatedFile = await raceWithAbort(
          validateCompressionFile(file),
          controller.signal,
        )
        throwIfAborted(controller.signal)

        if (validatedFile.format.id !== 'jpeg') {
          throw new CompressionCoreError(
            'unsupported-format',
            'En este paso solo puedes comprimir archivos JPEG.',
          )
        }

        const inspection = await inspectJpegFile(file, controller.signal)
        throwIfAborted(controller.signal)
        const previewUrl = URL.createObjectURL(file)

        if (
          controller.signal.aborted ||
          selectionRunIdRef.current !== runId
        ) {
          URL.revokeObjectURL(previewUrl)
          return
        }

        previewUrlRef.current = previewUrl
        setSelection({
          file,
          height: inspection.height,
          previewUrl,
          status: 'ready',
          width: inspection.width,
        })
      } catch (error) {
        if (selectionRunIdRef.current !== runId) return

        if (isOperationCancelledError(error)) {
          setSelection({ status: 'empty' })
          return
        }

        setSelection({
          message: getSelectionErrorMessage(error),
          status: 'error',
        })
      } finally {
        if (inspectionControllerRef.current === controller) {
          inspectionControllerRef.current = null
        }
      }
    },
    [job, releasePreview],
  )

  const clearSelection = useCallback(() => {
    if (job.isActive) return

    selectionRunIdRef.current += 1
    inspectionControllerRef.current?.abort()
    inspectionControllerRef.current = null
    releasePreview()
    if (job.state.status !== 'idle') job.reset()
    setSelection({ status: 'empty' })
  }, [job, releasePreview])

  const compress = useCallback(async () => {
    if (selection.status !== 'ready' || job.isActive) return

    await job.start({
      file: selection.file,
      options: { quality: quality / 100 },
      processorId: JPEG_COMPRESSION_PROCESSOR_ID,
    })
  }, [job, quality, selection])

  const resetResult = useCallback(() => {
    if (job.isActive || job.state.status === 'idle') return
    job.reset()
  }, [job])

  useEffect(
    () => () => {
      selectionRunIdRef.current += 1
      inspectionControllerRef.current?.abort()
      releasePreview()
      job.cancel()
    },
    [job, releasePreview],
  )

  return {
    cancel: () => job.cancel(),
    clearSelection,
    compress,
    jobState,
    quality,
    resetResult,
    selection,
    selectFile,
    setQuality,
  }
}
