import { useId, useRef, useState } from 'react'
import type {
  ChangeEvent,
  DragEvent,
} from 'react'
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  Download,
  FileImage,
  Gauge,
  Image as ImageIcon,
  LoaderCircle,
  MousePointer2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
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
import { useJpegCompression } from '@/features/file-compression/hooks/use-jpeg-compression'
import { downloadBlob, formatFileSize } from '@/lib/files'
import { cn } from '@/lib/utils'

const percentageFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 1,
})

const getQualityDescription = (quality: number) => {
  if (quality >= 90) {
    return 'Más detalle y un archivo final de mayor tamaño.'
  }

  if (quality >= 70) {
    return 'Buen equilibrio entre detalle visual y reducción de tamaño.'
  }

  return 'Mayor reducción, con pérdida de detalle más visible.'
}

export function JpegCompressionWorkspace() {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const {
    cancel,
    clearSelection,
    compress,
    jobState,
    quality,
    resetResult,
    selection,
    selectFile,
    setQuality,
  } = useJpegCompression()

  const isJobActive =
    jobState.status === 'validating' ||
    jobState.status === 'ready' ||
    jobState.status === 'processing'

  const openFilePicker = () => {
    if (!isJobActive && selection.status !== 'inspecting') {
      inputRef.current?.click()
    }
  }

  const receiveFile = (file?: File) => {
    if (!file || isJobActive) return
    void selectFile(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    receiveFile(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    receiveFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="mt-8 sm:mt-10">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,.jpg,.jpeg"
        className="sr-only"
        onChange={handleInputChange}
      />

      {selection.status !== 'ready' ? (
        <div className="mx-auto max-w-3xl">
          <div
            role="group"
            className={cn(
              'group grid min-h-72 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center outline-none transition sm:min-h-80 sm:px-8',
              'hover:border-[#ff7867] hover:bg-[#fff9f7]',
              isDragging && 'scale-[1.01] border-[#ff7867] bg-[#fff9f7] ring-4 ring-[#ff5a45]/10',
              selection.status === 'inspecting' && 'pointer-events-none',
            )}
            onClick={openFilePicker}
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setIsDragging(false)
              }
            }}
            onDrop={handleDrop}
            aria-busy={selection.status === 'inspecting'}
            aria-label="Carga de archivo JPEG"
          >
            <div>
              <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] transition-transform duration-300 group-hover:-translate-y-1">
                {selection.status === 'inspecting' ? (
                  <LoaderCircle className="size-9 animate-spin" aria-hidden="true" />
                ) : (
                  <ImageIcon className="size-9" strokeWidth={1.7} aria-hidden="true" />
                )}
                <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
                  <UploadCloud className="size-4" aria-hidden="true" />
                </span>
              </div>

              <div className="mt-6">
                <p className="text-lg font-semibold text-slate-950 sm:text-xl">
                  {selection.status === 'inspecting'
                    ? 'Inspeccionando JPEG…'
                    : 'Suelta tu JPEG aquí'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selection.status === 'inspecting'
                    ? selection.file.name
                    : 'o búscalo en tu dispositivo'}
                </p>
              </div>

              {selection.status !== 'inspecting' && (
                <Button
                  size="lg"
                  className="mt-6 h-11 rounded-xl bg-slate-950 px-5 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                  onClick={(event) => {
                    event.stopPropagation()
                    openFilePicker()
                  }}
                >
                  <MousePointer2 data-icon="inline-start" aria-hidden="true" />
                  Seleccionar JPEG
                </Button>
              )}

              <p className="mt-5 text-xs text-slate-400">
                Un archivo .jpg o .jpeg a la vez
              </p>
            </div>
          </div>

          {selection.status === 'error' && (
            <Alert
              variant="destructive"
              className="mt-4 border-red-200 bg-red-50 px-3 py-2.5"
            >
              <AlertCircle aria-hidden="true" />
              <AlertTitle>JPEG no compatible</AlertTitle>
              <AlertDescription>{selection.message}</AlertDescription>
            </Alert>
          )}
        </div>
      ) : jobState.status === 'success' ? (
        <section
          className="mx-auto max-w-4xl rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5 sm:p-8"
          aria-labelledby="jpeg-result-title"
        >
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </span>
            <h2
              id="jpeg-result-title"
              className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950"
            >
              Tu JPEG está listo
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Compresión terminada al {quality}% de calidad.
            </p>
          </div>

          <div className="mt-7 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
              <p className="text-xs font-semibold tracking-[0.12em] text-slate-500 uppercase">
                Original
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {formatFileSize(jobState.result.originalSize)}
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
                Comprimido
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                {formatFileSize(jobState.result.outputSize)}
              </p>
              <p
                className="mt-1 truncate text-xs text-slate-500"
                title={jobState.result.outputFileName}
              >
                {jobState.result.outputFileName}
              </p>
            </div>
          </div>

          <div
            className={cn(
              'mt-4 rounded-2xl px-4 py-3 text-center text-sm font-medium',
              jobState.result.isSmaller
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-900',
            )}
            role="status"
          >
            {jobState.result.isSmaller
              ? `${percentageFormatter.format(jobState.result.reductionPercentage)}% menos · ahorraste ${formatFileSize(jobState.result.bytesSaved)}`
              : `Con esta calidad el archivo aumentó ${percentageFormatter.format(Math.abs(jobState.result.reductionPercentage))}%. Puedes probar una calidad menor.`}
          </div>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 rounded-xl bg-[#e84c38] px-5 text-white hover:bg-[#cf3f2d]"
              onClick={() =>
                downloadBlob(
                  jobState.result.output,
                  jobState.result.outputFileName,
                )
              }
            >
              <Download data-icon="inline-start" aria-hidden="true" />
              Descargar JPEG
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 rounded-xl bg-white px-5"
              onClick={resetResult}
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Comprimir de nuevo
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-11 rounded-xl px-5"
              onClick={clearSelection}
            >
              Elegir otro archivo
            </Button>
          </div>

          {jobState.result.warnings.length > 0 && (
            <p className="mt-5 text-center text-xs leading-5 text-slate-500">
              {jobState.result.warnings.join(' ')}
            </p>
          )}
        </section>
      ) : (
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
                  <dd className="mt-0.5 font-medium text-slate-900">JPEG</dd>
                </div>
              </dl>
            </CardContent>
            <CardFooter className="justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 sm:px-6">
              <span className="text-xs text-slate-500">Se mantendrán las dimensiones</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                disabled={isJobActive}
                onClick={clearSelection}
              >
                Cambiar
              </Button>
            </CardFooter>
          </Card>

          <Card className="h-fit gap-0 rounded-3xl border-0 py-0 ring-1 ring-slate-200 lg:sticky lg:top-6">
            <CardHeader className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                <SlidersHorizontal className="size-5 text-[#e84c38]" aria-hidden="true" />
                Configurar compresión
              </CardTitle>
              <CardDescription>
                Ajusta cuánto detalle conservará el JPEG.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 py-6 sm:px-6">
              <div className="flex items-end justify-between gap-4">
                <label htmlFor={`${inputId}-quality`} className="text-sm font-medium text-slate-800">
                  Calidad
                </label>
                <output
                  id={`${inputId}-quality-value`}
                  className="text-2xl font-semibold tabular-nums text-slate-950"
                >
                  {quality}%
                </output>
              </div>
              <Slider
                id={`${inputId}-quality`}
                value={[quality]}
                min={10}
                max={100}
                step={5}
                disabled={isJobActive}
                aria-label="Calidad del JPEG"
                aria-describedby={`${inputId}-quality-description`}
                className="mt-5 [&_[data-slot=slider-range]]:bg-[#e84c38] [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[#e84c38]"
                onValueChange={(values) => {
                  const nextQuality = values[0]
                  if (typeof nextQuality === 'number') setQuality(nextQuality)
                }}
              />
              <div className="mt-2 flex justify-between text-[11px] text-slate-400" aria-hidden="true">
                <span>Menor tamaño</span>
                <span>Más detalle</span>
              </div>
              <p
                id={`${inputId}-quality-description`}
                className="mt-4 min-h-10 text-sm leading-5 text-slate-600"
              >
                {getQualityDescription(quality)}
              </p>

              <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Gauge className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Qué cambiará</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Se volverá a codificar la imagen. El ancho y alto no cambian.
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
                  <AlertTitle>No se pudo comprimir</AlertTitle>
                  <AlertDescription>{jobState.error.message}</AlertDescription>
                </Alert>
              )}

              {jobState.status === 'cancelled' && (
                <Alert className="mt-5 border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>Compresión cancelada</AlertTitle>
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
                        ? jobState.progress.message ?? 'Comprimiendo…'
                        : jobState.status === 'validating'
                          ? 'Validando archivo…'
                          : 'Preparando compresión…'}
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
                    onClick={cancel}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="mt-6 h-11 w-full rounded-xl bg-[#e84c38] text-white shadow-lg shadow-[#e84c38]/15 hover:bg-[#cf3f2d]"
                  onClick={() => void compress()}
                >
                  <Download data-icon="inline-start" aria-hidden="true" />
                  Comprimir JPEG
                </Button>
              )}
            </CardContent>
            <CardFooter className="gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-xs leading-5 text-slate-500 sm:px-6">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
              Se procesa localmente y nunca se sube a un servidor.
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
