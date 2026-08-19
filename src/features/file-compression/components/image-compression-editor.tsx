import { useId } from 'react'
import {
  AlertCircle,
  Download,
  FileImage,
  Gauge,
  ShieldCheck,
  SlidersHorizontal,
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
import type { CompressionJobState } from '@/features/file-compression/core'
import type { ReadyImageSelection } from '@/features/file-compression/hooks/use-image-compression'
import { formatFileSize } from '@/lib/files'

const getJpegQualityDescription = (quality: number) => {
  if (quality >= 90) return 'Más detalle y un archivo final de mayor tamaño.'
  if (quality >= 70) {
    return 'Buen equilibrio entre detalle visual y reducción de tamaño.'
  }
  return 'Mayor reducción, con pérdida de detalle más visible.'
}

const getPngLevelDescription = (level: number) => {
  if (level >= 4) return 'Mayor compresión posible, con más tiempo de procesamiento.'
  if (level >= 3) return 'Compresión alta con un tiempo de procesamiento equilibrado.'
  if (level >= 2) return 'Optimización estándar y rápida.'
  return 'Optimización ligera para obtener el resultado más rápido.'
}

type ImageCompressionEditorProps = {
  isJobActive: boolean
  jpegQuality: number
  jobState: CompressionJobState
  pngLevel: number
  selection: ReadyImageSelection
  onCancel: () => void
  onClear: () => void
  onCompress: () => void
  onJpegQualityChange: (quality: number) => void
  onPngLevelChange: (level: number) => void
}

export function ImageCompressionEditor({
  isJobActive,
  jpegQuality,
  jobState,
  pngLevel,
  selection,
  onCancel,
  onClear,
  onCompress,
  onJpegQualityChange,
  onPngLevelChange,
}: ImageCompressionEditorProps) {
  const controlId = useId()
  const isPng = selection.format === 'png'
  const formatLabel = isPng ? 'PNG' : 'JPEG'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
      <Card className="gap-0 overflow-hidden rounded-3xl border-0 py-0 ring-1 ring-slate-200">
        <CardHeader className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold text-slate-950">
            <FileImage className="size-4 shrink-0 text-[#e84c38]" aria-hidden="true" />
            <span className="truncate" title={selection.file.name}>
              {selection.file.name}
            </span>
          </CardTitle>
          <CardDescription>Vista previa del archivo original</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid min-h-64 place-items-center overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#eef2f7_25%,transparent_25%),linear-gradient(225deg,#eef2f7_25%,transparent_25%),linear-gradient(45deg,#eef2f7_25%,transparent_25%),linear-gradient(315deg,#eef2f7_25%,#f8fafc_25%)] bg-[length:20px_20px] bg-[position:10px_0,10px_0,0_0,0_0] sm:min-h-80">
            <img
              src={selection.previewUrl}
              alt={`Vista previa de ${selection.file.name}`}
              className="max-h-[28rem] w-full object-contain"
            />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-xs text-slate-500">Tamaño</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-slate-900">
                {formatFileSize(selection.file.size)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
              <dt className="text-xs text-slate-500">Dimensiones</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-slate-900">
                {selection.width} × {selection.height}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2.5 sm:col-span-1">
              <dt className="text-xs text-slate-500">Formato</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{formatLabel}</dd>
            </div>
          </dl>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
          <span className="text-xs text-slate-500">
            {isPng
              ? 'Se conservarán dimensiones y transparencia'
              : 'Se mantendrán las dimensiones'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            disabled={isJobActive}
            onClick={onClear}
          >
            Cambiar
          </Button>
        </CardFooter>
      </Card>

      <Card className="h-fit gap-0 rounded-3xl border-0 py-0 ring-1 ring-slate-200 lg:sticky lg:top-6">
        <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <SlidersHorizontal className="size-5 text-[#e84c38]" aria-hidden="true" />
            {isPng ? 'Optimizar sin pérdida' : 'Configurar compresión'}
          </CardTitle>
          <CardDescription>
            {isPng
              ? 'El nivel cambia el tiempo, nunca la calidad de la imagen.'
              : 'Ajusta cuánto detalle conservará el JPEG.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 py-6 sm:px-6">
          {isPng ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <label htmlFor={`${controlId}-png-level`} className="text-sm font-medium text-slate-800">
                  Nivel de optimización
                </label>
                <output className="text-2xl font-semibold tabular-nums text-slate-950">
                  {pngLevel}
                </output>
              </div>
              <Slider
                id={`${controlId}-png-level`}
                value={[pngLevel]}
                min={1}
                max={4}
                step={1}
                disabled={isJobActive}
                aria-label="Nivel de optimización PNG"
                aria-describedby={`${controlId}-png-description`}
                className="mt-5 [&_[data-slot=slider-range]]:bg-[#e84c38] [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[#e84c38]"
                onValueChange={(values) => {
                  const nextLevel = values[0]
                  if (typeof nextLevel === 'number') onPngLevelChange(nextLevel)
                }}
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-400" aria-hidden="true">
                <span>Más rápido</span>
                <span>Menor tamaño</span>
              </div>
              <p
                id={`${controlId}-png-description`}
                className="mt-4 min-h-10 text-sm leading-5 text-slate-600"
              >
                {getPngLevelDescription(pngLevel)}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-end justify-between gap-4">
                <label htmlFor={`${controlId}-jpeg-quality`} className="text-sm font-medium text-slate-800">
                  Calidad
                </label>
                <output className="text-2xl font-semibold tabular-nums text-slate-950">
                  {jpegQuality}%
                </output>
              </div>
              <Slider
                id={`${controlId}-jpeg-quality`}
                value={[jpegQuality]}
                min={10}
                max={100}
                step={5}
                disabled={isJobActive}
                aria-label="Calidad del JPEG"
                aria-describedby={`${controlId}-jpeg-description`}
                className="mt-5 [&_[data-slot=slider-range]]:bg-[#e84c38] [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[#e84c38]"
                onValueChange={(values) => {
                  const nextQuality = values[0]
                  if (typeof nextQuality === 'number') {
                    onJpegQualityChange(nextQuality)
                  }
                }}
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-400" aria-hidden="true">
                <span>Menor tamaño</span>
                <span>Más detalle</span>
              </div>
              <p
                id={`${controlId}-jpeg-description`}
                className="mt-4 min-h-10 text-sm leading-5 text-slate-600"
              >
                {getJpegQualityDescription(jpegQuality)}
              </p>
            </>
          )}

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <Gauge className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-slate-800">Qué cambiará</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isPng
                    ? 'OxiPNG reorganiza y recomprime los datos sin modificar píxeles ni canal alfa.'
                    : 'Se volverá a codificar la imagen. El ancho y alto no cambian.'}
                </p>
              </div>
            </div>
          </div>

          {jobState.status === 'error' && (
            <Alert
              variant="destructive"
              className="mt-5 border-red-200 bg-red-50 px-3 py-2.5"
            >
              <AlertCircle aria-hidden="true" />
              <AlertTitle>No se pudo {isPng ? 'optimizar' : 'comprimir'}</AlertTitle>
              <AlertDescription>{jobState.error.message}</AlertDescription>
            </Alert>
          )}

          {jobState.status === 'cancelled' && (
            <Alert className="mt-5 border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Proceso cancelado</AlertTitle>
              <AlertDescription className="text-amber-800">
                El archivo original sigue intacto. Puedes intentarlo de nuevo.
              </AlertDescription>
            </Alert>
          )}

          {isJobActive ? (
            <div className="mt-6" aria-live="polite">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-800">
                  {jobState.status === 'processing'
                    ? jobState.progress.message ?? 'Procesando…'
                    : jobState.status === 'validating'
                      ? 'Validando archivo…'
                      : 'Preparando proceso…'}
                </span>
                <span className="tabular-nums text-slate-500">
                  {jobState.status === 'processing'
                    ? `${jobState.progress.percentage}%`
                    : '0%'}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso de compresión"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  jobState.status === 'processing'
                    ? jobState.progress.percentage
                    : 0
                }
                className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className="h-full rounded-full bg-[#e84c38] transition-[width] duration-300"
                  style={{
                    width: `${
                      jobState.status === 'processing'
                        ? jobState.progress.percentage
                        : 0
                    }%`,
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="lg"
                className="mt-4 h-11 w-full rounded-xl"
                onClick={onCancel}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              className="mt-6 h-11 w-full rounded-xl bg-[#e84c38] text-white shadow-lg shadow-[#e84c38]/15 hover:bg-[#cf3f2d]"
              onClick={onCompress}
            >
              <Download data-icon="inline-start" aria-hidden="true" />
              {isPng ? 'Optimizar PNG' : 'Comprimir JPEG'}
            </Button>
          )}
        </CardContent>
        <CardFooter className="gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6">
          <ShieldCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
          Se procesa localmente y nunca se sube a un servidor.
        </CardFooter>
      </Card>
    </div>
  )
}
