import { useId } from 'react'
import {
  Archive,
  CheckCircle2,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import type {
  CompressionArchiveState,
  CompressionBatchStatus,
  CompressionFileItem,
} from '@/features/file-compression/hooks/use-file-compression'
import { cn } from '@/lib/utils'

type CompressionSettingsPanelProps = {
  archiveState: CompressionArchiveState
  batchStatus: CompressionBatchStatus
  generalError: string | null
  isBusy: boolean
  isProcessing: boolean
  items: readonly CompressionFileItem[]
  pngLevel: number
  quality: number
  onCancelBatch: () => void
  onCompress: () => void
  onPngLevelChange: (level: number) => void
  onQualityChange: (quality: number) => void
}

const getQualityDescription = (quality: number) => {
  if (quality >= 90) return 'Más detalle y un archivo final de mayor tamaño.'
  if (quality >= 70) {
    return 'Buen equilibrio entre detalle visual y reducción de tamaño.'
  }
  return 'Mayor reducción, con pérdida de detalle más visible.'
}

const getPngLevelDescription = (level: number) => {
  if (level >= 4) return 'Mayor compresión posible, con más tiempo de proceso.'
  if (level >= 3) return 'Compresión alta con un tiempo equilibrado.'
  if (level >= 2) return 'Optimización estándar y rápida.'
  return 'Optimización ligera para obtener el resultado más rápido.'
}

export function CompressionSettingsPanel({
  archiveState,
  batchStatus,
  generalError,
  isBusy,
  isProcessing,
  items,
  pngLevel,
  quality,
  onCancelBatch,
  onCompress,
  onPngLevelChange,
  onQualityChange,
}: CompressionSettingsPanelProps) {
  const qualityId = useId()
  const pngLevelId = useId()
  const hasLossyImages = items.some((item) =>
    item.format === 'jpeg' || item.format === 'webp' || item.format === 'avif',
  )
  const hasPng = items.some((item) => item.format === 'png')
  const hasPdf = items.some((item) => item.format === 'pdf')

  return (
    <Card className="h-fit gap-0 rounded-3xl border-0 py-0 ring-1 ring-slate-200 lg:sticky lg:top-6">
      <CardHeader className="border-b border-slate-100 px-5 py-5">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
          <SlidersHorizontal className="size-5 text-[#e84c38]" aria-hidden="true" />
          Configuración
        </CardTitle>
        <CardDescription>
          Cada formato usa su procesador especializado.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 px-5 py-6">
        {hasLossyImages && (
          <section aria-labelledby={`${qualityId}-label`}>
            <div className="flex items-end justify-between gap-4">
              <label
                id={`${qualityId}-label`}
                htmlFor={qualityId}
                className="text-sm font-medium text-slate-800"
              >
                Calidad de imagen
              </label>
              <output className="text-xl font-semibold tabular-nums text-slate-950">
                {quality}%
              </output>
            </div>
            <Slider
              id={qualityId}
              value={[quality]}
              min={10}
              max={100}
              step={5}
              disabled={isBusy}
              aria-labelledby={`${qualityId}-label`}
              className="mt-4 [&_[data-slot=slider-range]]:bg-[#e84c38] [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[#e84c38]"
              onValueChange={(values) => {
                const nextQuality = values[0]
                if (typeof nextQuality === 'number') {
                  onQualityChange(nextQuality)
                }
              }}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {getQualityDescription(quality)} Aplica a JPEG, WebP y AVIF.
            </p>
          </section>
        )}

        {hasPng && (
          <section
            className={cn(
              hasLossyImages && 'border-t border-slate-100 pt-5',
            )}
            aria-labelledby={`${pngLevelId}-label`}
          >
            <div className="flex items-end justify-between gap-4">
              <label
                id={`${pngLevelId}-label`}
                htmlFor={pngLevelId}
                className="text-sm font-medium text-slate-800"
              >
                Optimización PNG
              </label>
              <output className="text-xl font-semibold tabular-nums text-slate-950">
                {pngLevel}
              </output>
            </div>
            <Slider
              id={pngLevelId}
              value={[pngLevel]}
              min={1}
              max={4}
              step={1}
              disabled={isBusy}
              aria-labelledby={`${pngLevelId}-label`}
              className="mt-4 [&_[data-slot=slider-range]]:bg-[#e84c38] [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[#e84c38]"
              onValueChange={(values) => {
                const nextLevel = values[0]
                if (typeof nextLevel === 'number') {
                  onPngLevelChange(nextLevel)
                }
              }}
            />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {getPngLevelDescription(pngLevel)} No cambia los píxeles.
            </p>
          </section>
        )}

        {hasPdf && (
          <section
            className={cn(
              (hasLossyImages || hasPng) &&
                'border-t border-slate-100 pt-5',
            )}
          >
            <div className="flex items-start gap-3 rounded-2xl bg-[#fff7f5] p-4">
              <Gauge className="mt-0.5 size-5 shrink-0 text-[#e84c38]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  PDF · modo estructural
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Reorganiza objetos sin rasterizar páginas. Los PDF firmados se rechazan para no invalidar su firma.
                </p>
              </div>
            </div>
          </section>
        )}

        {generalError && (
          <Alert
            variant="destructive"
            className="border-red-200 bg-red-50 px-3 py-2.5"
          >
            <XCircle aria-hidden="true" />
            <AlertTitle>No se pudo iniciar el lote</AlertTitle>
            <AlertDescription>{generalError}</AlertDescription>
          </Alert>
        )}

        {archiveState.status === 'error' && (
          <Alert
            variant="destructive"
            className="border-red-200 bg-red-50 px-3 py-2.5"
          >
            <XCircle aria-hidden="true" />
            <AlertTitle>No se pudo crear el ZIP</AlertTitle>
            <AlertDescription>{archiveState.message}</AlertDescription>
          </Alert>
        )}

        {batchStatus === 'cancelled' && (
          <Alert className="border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
            <XCircle aria-hidden="true" />
            <AlertTitle>Lote cancelado</AlertTitle>
            <AlertDescription className="text-amber-800">
              Los resultados terminados siguen disponibles.
            </AlertDescription>
          </Alert>
        )}

        {isProcessing ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={onCancelBatch}
          >
            <XCircle data-icon="inline-start" aria-hidden="true" />
            Cancelar procesamiento
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl bg-[#e84c38] text-white shadow-lg shadow-[#e84c38]/15 hover:bg-[#cf3f2d]"
            disabled={isBusy || !items.length}
            onClick={onCompress}
          >
            {batchStatus === 'completed' ? (
              <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Archive data-icon="inline-start" aria-hidden="true" />
            )}
            {batchStatus === 'completed'
              ? 'Comprimir de nuevo'
              : `Comprimir ${items.length === 1 ? 'archivo' : `${items.length} archivos`}`}
          </Button>
        )}
      </CardContent>

      <CardFooter className="gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-500">
        <ShieldCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
        Todo se procesa localmente y en secuencia en tu navegador.
      </CardFooter>
    </Card>
  )
}
