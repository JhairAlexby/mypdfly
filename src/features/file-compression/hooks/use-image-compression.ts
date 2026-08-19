import { useCallback, useEffect, useRef, useState } from 'react'

import {
  CompressionCoreError,
  CompressionJob,
  validateCompressionFile,
} from '@/features/file-compression/core'
import {
  DEFAULT_JPEG_COMPRESSION_QUALITY,
  DEFAULT_PNG_OPTIMIZATION_LEVEL,
  inspectBrowserImageFile,
  JPEG_COMPRESSION_PROCESSOR_ID,
  PNG_COMPRESSION_PROCESSOR_ID,
  registerImageCompressionProcessors,
} from '@/features/file-compression/processors'
import {
  isOperationCancelledError,
  raceWithAbort,
  throwIfAborted,
} from '@/lib/files'
import { useCompressionJobState } from './use-compression-job-state'

export type SupportedImageCompressionFormat = 'jpeg' | 'png'

export type ImageSelectionState =
  | { readonly status: 'empty' }
  | { readonly status: 'inspecting'; readonly file: File }
  | {
      readonly status: 'ready'
      readonly file: File
      readonly format: SupportedImageCompressionFormat
      readonly height: number
      readonly previewUrl: string
      readonly width: number
    }
  | { readonly status: 'error'; readonly message: string }

export type ReadyImageSelection = Extract<
  ImageSelectionState,
  { readonly status: 'ready' }
>

registerImageCompressionProcessors()

const getSelectionErrorMessage = (error: unknown) => {
  if (error instanceof CompressionCoreError) return error.message
  if (error instanceof Error) return error.message

  return 'No se pudo inspeccionar la imagen seleccionada.'
}

export const useImageCompression = () => {
  const [job] = useState(() => new CompressionJob())
  const jobState = useCompressionJobState(job)
  const [jpegQuality, setJpegQuality] = useState(
    Math.round(DEFAULT_JPEG_COMPRESSION_QUALITY * 100),
  )
  const [pngLevel, setPngLevel] = useState(
    DEFAULT_PNG_OPTIMIZATION_LEVEL,
  )
  const [selection, setSelection] = useState<ImageSelectionState>({
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

        const format = validatedFile.format.id

        if (format !== 'jpeg' && format !== 'png') {
          throw new CompressionCoreError(
            'unsupported-format',
            'Solo puedes comprimir imágenes JPEG o PNG.',
          )
        }

        const inspection = await inspectBrowserImageFile(
          file,
          controller.signal,
        )
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
          format,
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

    const isPng = selection.format === 'png'

    await job.start({
      file: selection.file,
      options: isPng
        ? { level: pngLevel }
        : { quality: jpegQuality / 100 },
      processorId: isPng
        ? PNG_COMPRESSION_PROCESSOR_ID
        : JPEG_COMPRESSION_PROCESSOR_ID,
    })
  }, [job, jpegQuality, pngLevel, selection])

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
    jpegQuality,
    pngLevel,
    resetResult,
    selection,
    selectFile,
    setJpegQuality,
    setPngLevel,
  }
}
