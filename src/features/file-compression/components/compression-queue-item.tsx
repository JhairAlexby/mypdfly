import {
  Download,
  FileImage,
  FileText,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CompressionJobState } from '@/features/file-compression/core'
import type { CompressionFileItem } from '@/features/file-compression/hooks/use-file-compression'
import { formatFileSize } from '@/lib/files'
import { cn } from '@/lib/utils'

const percentageFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 1,
})

const getItemStatus = (state?: CompressionJobState) => {
  if (!state || state.status === 'idle') {
    return {
      className: 'border-slate-200 bg-slate-50 text-slate-600',
      label: 'Pendiente',
    }
  }
  if (
    state.status === 'validating' ||
    state.status === 'ready' ||
    state.status === 'processing'
  ) {
    return {
      className: 'border-blue-200 bg-blue-50 text-blue-700',
      label: 'Procesando',
    }
  }
  if (state.status === 'success') {
    return {
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      label: 'Listo',
    }
  }
  if (state.status === 'cancelled') {
    return {
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      label: 'Cancelado',
    }
  }

  return {
    className: 'border-red-200 bg-red-50 text-red-700',
    label: 'Error',
  }
}

const getItemDetails = (item: CompressionFileItem) => {
  if (item.format === 'pdf') {
    return `${item.pageCount ?? 0} ${item.pageCount === 1 ? 'página' : 'páginas'}`
  }
  return item.width && item.height
    ? `${item.width} × ${item.height} px`
    : 'Imagen estática'
}

type CompressionQueueItemProps = {
  isBusy: boolean
  item: CompressionFileItem
  state?: CompressionJobState
  onDownload: () => void
  onRemove: () => void
}

export function CompressionQueueItem({
  isBusy,
  item,
  state,
  onDownload,
  onRemove,
}: CompressionQueueItemProps) {
  const status = getItemStatus(state)
  const result = state?.status === 'success' ? state.result : undefined
  const usedOriginal = result?.metadata.usedOriginal === true
  const didNotReduce = result ? !result.isSmaller : false

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100 text-slate-500 sm:size-14">
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : item.format === 'pdf' ? (
            <FileText className="size-6 text-[#e84c38]" aria-hidden="true" />
          ) : (
            <FileImage className="size-6" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950"
              title={item.file.name}
            >
              {item.file.name}
            </p>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {item.formatLabel} · {formatFileSize(item.file.size)} ·{' '}
            {getItemDetails(item)}
          </p>

          {state?.status === 'processing' && (
            <div className="mt-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-600">
                  {state.progress.message ?? 'Procesando…'}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {state.progress.percentage}%
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`Progreso de ${item.file.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.progress.percentage}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-[#e84c38] transition-[width] duration-300"
                  style={{ width: `${state.progress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {state?.status === 'success' && (
            <div
              className={cn(
                'mt-3 flex flex-col gap-2 rounded-xl px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
                didNotReduce ? 'bg-amber-50' : 'bg-emerald-50',
              )}
            >
              <div
                className={cn(
                  'min-w-0 text-xs',
                  didNotReduce ? 'text-amber-900' : 'text-emerald-800',
                )}
              >
                <p className="font-medium">
                  {usedOriginal
                    ? 'El original ya era la versión más pequeña.'
                    : state.result.isSmaller
                      ? `${formatFileSize(state.result.outputSize)} · ${percentageFormatter.format(state.result.reductionPercentage)}% menos`
                      : `${formatFileSize(state.result.outputSize)} · ${percentageFormatter.format(Math.abs(state.result.reductionPercentage))}% más`}
                </p>
                {state.result.isSmaller && (
                  <p className="mt-0.5 text-emerald-700">
                    Ahorro: {formatFileSize(state.result.bytesSaved)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  'h-8 shrink-0 bg-white',
                  didNotReduce
                    ? 'border-amber-200 text-amber-900 hover:bg-amber-100'
                    : 'border-emerald-200 text-emerald-800 hover:bg-emerald-100',
                )}
                onClick={onDownload}
              >
                <Download data-icon="inline-start" aria-hidden="true" />
                Descargar
              </Button>
            </div>
          )}

          {state?.status === 'error' && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
              {state.error.message}
            </p>
          )}

          {state?.status === 'cancelled' && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No se modificó el archivo original.
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
          aria-label={`Quitar ${item.file.name}`}
          disabled={isBusy}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
