import {
  Check,
  Download,
  FileText,
  Image,
  LoaderCircle,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { ImageFormat } from './image-encoders'

export type ExportDialogFormat = 'pdf' | ImageFormat

export type ExportDialogPhase =
  | 'idle'
  | 'running'
  | 'success'
  | 'cancelled'
  | 'error'

type ExportDialogProps = {
  open: boolean
  format: ExportDialogFormat | null
  pageCount: number
  phase: ExportDialogPhase
  currentPage: number
  totalPages: number
  progressMessage: string
  error: string
  cancelRequested: boolean
  onOpenChange: (open: boolean) => void
  onStart: () => void
  onCancel: () => void
}

const formatLabels: Record<ExportDialogFormat, string> = {
  jpeg: 'JPEG',
  pdf: 'PDF',
  png: 'PNG',
}

const getFormatDescription = (
  format: ExportDialogFormat,
  pageCount: number,
) => {
  if (format === 'pdf') {
    return `Se generará un PDF con ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}.`
  }

  return pageCount === 1
    ? `Se descargará una imagen ${formatLabels[format]} directamente.`
    : `Se generará un ZIP con ${pageCount} imágenes ${formatLabels[format]}.`
}

const getPhaseTitle = (phase: ExportDialogPhase) => {
  if (phase === 'running') return 'Exportando documento'
  if (phase === 'success') return 'Exportación completada'
  if (phase === 'cancelled') return 'Exportación cancelada'
  if (phase === 'error') return 'No se pudo exportar'
  return 'Exportar documento'
}

export function ExportDialog({
  open,
  format,
  pageCount,
  phase,
  currentPage,
  totalPages,
  progressMessage,
  error,
  cancelRequested,
  onOpenChange,
  onStart,
  onCancel,
}: ExportDialogProps) {
  if (!format) return null

  const isRunning = phase === 'running'
  const progress = totalPages
    ? Math.min(100, Math.round((currentPage / totalPages) * 100))
    : 0
  const FormatIcon = format === 'pdf' ? FileText : Image

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isRunning && !nextOpen) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="gap-5 sm:max-w-md"
        showCloseButton={!isRunning}
      >
        <DialogHeader>
          <DialogTitle>{getPhaseTitle(phase)}</DialogTitle>
          <DialogDescription>
            Revisa el formato y confirma la descarga. Puedes cancelarla mientras
            se prepara.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" aria-live="polite">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FormatIcon aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Formato {formatLabels[format]}</p>
              <p className="text-xs text-muted-foreground">
                {getFormatDescription(format, pageCount)}
              </p>
            </div>
          </div>

          {phase === 'idle' && (
            <p className="text-sm text-muted-foreground">
              Las ediciones y el orden actual de las páginas se conservarán.
            </p>
          )}

          {phase === 'running' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate">
                  {progressMessage || 'Preparando exportación…'}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {currentPage}/{totalPages}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Progreso de exportación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-full rounded-full bg-[#ff5a45] transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {cancelRequested
                  ? 'Cancelando y liberando recursos…'
                  : 'No cierres esta pestaña hasta terminar.'}
              </p>
            </div>
          )}

          {phase === 'success' && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              <span>
                La descarga se inició correctamente.
              </span>
            </div>
          )}

          {phase === 'cancelled' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <X className="size-4 shrink-0" aria-hidden="true" />
              <span>No se descargó ningún archivo.</span>
            </div>
          )}

          {phase === 'error' && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
              role="alert"
            >
              {error || 'Ocurrió un error inesperado durante la exportación.'}
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === 'idle' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={onStart}>
                <Download data-icon="inline-start" />
                Exportar {formatLabels[format]}
              </Button>
            </>
          )}

          {phase === 'running' && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={cancelRequested}
            >
              {cancelRequested ? (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              ) : (
                <X data-icon="inline-start" />
              )}
              {cancelRequested ? 'Cancelando…' : 'Cancelar exportación'}
            </Button>
          )}

          {(phase === 'success' || phase === 'cancelled') && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          )}

          {phase === 'error' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
              <Button type="button" onClick={onStart}>
                Reintentar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
