import { useId, useMemo, useRef } from 'react'
import type { ChangeEvent } from 'react'
import {
  Archive,
  Download,
  LoaderCircle,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  CompressionBatchProgress,
  CompressionJobState,
} from '@/features/file-compression/core'
import { COMPRESSION_FILE_ACCEPT } from '@/features/file-compression/file-accept'
import type {
  CompressionArchiveState,
  CompressionBatchStatus,
  CompressionFileItem,
} from '@/features/file-compression/hooks/use-file-compression'
import { formatFileSize } from '@/lib/files'
import { CompressionQueueItem } from './compression-queue-item'
import { CompressionSettingsPanel } from './compression-settings-panel'

type CompressionDashboardProps = {
  archiveState: CompressionArchiveState
  batchProgress: CompressionBatchProgress
  batchStatus: CompressionBatchStatus
  generalError: string | null
  isInspecting: boolean
  itemStates: Readonly<Record<string, CompressionJobState>>
  items: readonly CompressionFileItem[]
  pngLevel: number
  quality: number
  successfulCount: number
  onAddFiles: (files: readonly File[]) => void
  onCancelArchive: () => void
  onCancelBatch: () => void
  onClear: () => void
  onCompress: () => void
  onDownloadAll: () => void
  onDownloadResult: (itemId: string) => void
  onPngLevelChange: (level: number) => void
  onQualityChange: (quality: number) => void
  onRemoveItem: (itemId: string) => void
}

export function CompressionDashboard({
  archiveState,
  batchProgress,
  batchStatus,
  generalError,
  isInspecting,
  itemStates,
  items,
  pngLevel,
  quality,
  successfulCount,
  onAddFiles,
  onCancelArchive,
  onCancelBatch,
  onClear,
  onCompress,
  onDownloadAll,
  onDownloadResult,
  onPngLevelChange,
  onQualityChange,
  onRemoveItem,
}: CompressionDashboardProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const isProcessing = batchStatus === 'processing'
  const isCreatingArchive = archiveState.status === 'creating'
  const isBusy = isProcessing || isCreatingArchive || isInspecting
  const originalTotal = useMemo(
    () => items.reduce((total, item) => total + item.file.size, 0),
    [items],
  )
  const resultTotal = useMemo(
    () =>
      items.reduce((total, item) => {
        const state = itemStates[item.id]
        return state?.status === 'success'
          ? total + state.result.outputSize
          : total
      }, 0),
    [itemStates, items],
  )

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files
    if (files?.length) onAddFiles(Array.from(files))
    event.currentTarget.value = ''
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <Card className="min-w-0 gap-0 rounded-3xl border-0 py-0 ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-950">
                Archivos seleccionados
              </CardTitle>
              <CardDescription className="mt-1">
                {items.length} {items.length === 1 ? 'archivo' : 'archivos'} ·{' '}
                {formatFileSize(originalTotal)} en total
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                id={inputId}
                type="file"
                accept={COMPRESSION_FILE_ACCEPT}
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
              >
                {isInspecting ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus data-icon="inline-start" aria-hidden="true" />
                )}
                Agregar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-lg text-slate-500"
                disabled={isBusy}
                onClick={onClear}
              >
                Limpiar
              </Button>
            </div>
          </div>

          {isProcessing && (
            <div className="mt-2" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                <span>
                  Procesando{' '}
                  {Math.min(
                    batchProgress.completed + 1,
                    batchProgress.total,
                  )}{' '}
                  de {batchProgress.total}
                </span>
                <span className="tabular-nums">
                  {batchProgress.percentage}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso total del lote"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={batchProgress.percentage}
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-[#e84c38] transition-[width] duration-300"
                  style={{ width: `${batchProgress.percentage}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="bg-slate-50/60 p-3 sm:p-4">
          <ul className="space-y-3" aria-label="Cola de compresión">
            {items.map((item) => (
              <CompressionQueueItem
                key={item.id}
                item={item}
                state={itemStates[item.id]}
                isBusy={isBusy}
                onDownload={() => onDownloadResult(item.id)}
                onRemove={() => onRemoveItem(item.id)}
              />
            ))}
          </ul>
        </CardContent>

        {successfulCount > 0 && (
          <CardFooter className="flex-col items-stretch gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">
                {successfulCount} {successfulCount === 1 ? 'resultado' : 'resultados'}
              </span>
              {batchStatus === 'completed' && (
                <span> · {formatFileSize(resultTotal)} finales</span>
              )}
            </div>
            {archiveState.status === 'creating' ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={onCancelArchive}
              >
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Cancelar ZIP ({archiveState.percentage}%)
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-slate-950 text-white hover:bg-slate-800"
                disabled={isProcessing}
                onClick={onDownloadAll}
              >
                {successfulCount > 1 ? (
                  <Archive data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <Download data-icon="inline-start" aria-hidden="true" />
                )}
                {successfulCount > 1
                  ? 'Descargar todo en ZIP'
                  : 'Descargar resultado'}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      <CompressionSettingsPanel
        archiveState={archiveState}
        batchStatus={batchStatus}
        generalError={generalError}
        isBusy={isBusy}
        isProcessing={isProcessing}
        items={items}
        pngLevel={pngLevel}
        quality={quality}
        onCancelBatch={onCancelBatch}
        onCompress={onCompress}
        onPngLevelChange={onPngLevelChange}
        onQualityChange={onQualityChange}
      />
    </div>
  )
}
