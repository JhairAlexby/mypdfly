import {
  ArrowDown,
  CheckCircle2,
  Download,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CompressionResult } from '@/features/file-compression/core'
import type { ReadyImageSelection } from '@/features/file-compression/hooks/use-image-compression'
import { downloadBlob, formatFileSize } from '@/lib/files'
import { cn } from '@/lib/utils'

const percentageFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 1,
})

type ImageCompressionResultProps = {
  jpegQuality: number
  pngLevel: number
  result: CompressionResult
  selection: ReadyImageSelection
  onClear: () => void
  onReset: () => void
}

export function ImageCompressionResult({
  jpegQuality,
  pngLevel,
  result,
  selection,
  onClear,
  onReset,
}: ImageCompressionResultProps) {
  const isPng = selection.format === 'png'
  const formatLabel = isPng ? 'PNG' : 'JPEG'

  return (
    <section
      className="mx-auto max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-8"
      aria-labelledby="image-result-title"
    >
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h2
          id="image-result-title"
          className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
        >
          Tu {formatLabel} está listo
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {isPng
            ? `Optimización sin pérdida · nivel ${pngLevel}.`
            : `Compresión terminada al ${jpegQuality}% de calidad.`}
        </p>
        {isPng && (
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Transparencia y dimensiones preservadas
          </p>
        )}
      </div>

      <div className="mt-7 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
            Original
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {formatFileSize(result.originalSize)}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500" title={selection.file.name}>
            {selection.file.name}
          </p>
        </div>

        <span className="grid place-items-center text-slate-400" aria-hidden="true">
          <ArrowDown className="size-5 sm:-rotate-90" />
        </span>

        <div className="rounded-2xl border border-emerald-200 bg-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold tracking-[0.12em] text-emerald-700 uppercase">
            {isPng ? 'Optimizado' : 'Comprimido'}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
            {formatFileSize(result.outputSize)}
          </p>
          <p
            className="mt-1 truncate text-xs text-slate-500"
            title={result.outputFileName}
          >
            {result.outputFileName}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'mt-4 rounded-2xl px-4 py-3 text-center text-sm font-medium',
          result.isSmaller
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-amber-100 text-amber-900',
        )}
        role="status"
      >
        {result.isSmaller
          ? `${percentageFormatter.format(result.reductionPercentage)}% menos · ahorraste ${formatFileSize(result.bytesSaved)}`
          : isPng
            ? 'Este PNG ya estaba optimizado. Se conservó el original sin aumentar su tamaño.'
            : `Con esta calidad el archivo aumentó ${percentageFormatter.format(Math.abs(result.reductionPercentage))}%. Puedes probar una calidad menor.`}
      </div>

      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-11 rounded-xl bg-[#e84c38] px-5 text-white hover:bg-[#cf3f2d]"
          onClick={() => downloadBlob(result.output, result.outputFileName)}
        >
          <Download data-icon="inline-start" aria-hidden="true" />
          Descargar {formatLabel}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11 rounded-xl bg-white px-5"
          onClick={onReset}
        >
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          {isPng ? 'Optimizar de nuevo' : 'Comprimir de nuevo'}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="h-11 rounded-xl px-5"
          onClick={onClear}
        >
          Elegir otro archivo
        </Button>
      </div>

      {result.warnings.length > 0 && (
        <p className="mt-5 text-center text-xs leading-5 text-slate-500">
          {result.warnings.join(' ')}
        </p>
      )}
    </section>
  )
}
