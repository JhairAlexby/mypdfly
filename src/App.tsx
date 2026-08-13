import { lazy, Suspense, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import {
  AlertCircle,
  Check,
  Eye,
  FileText,
  Files,
  LockKeyhole,
  MousePointer2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import './App.css'

const PdfEditor = lazy(() =>
  import('@/components/pdf-editor').then((module) => ({
    default: module.PdfEditor,
  })),
)

const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  return `${new Intl.NumberFormat('es-MX', {
    maximumFractionDigits: 1,
  }).format(bytes / (1024 * 1024))} MB`
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const selectFile = () => inputRef.current?.click()

  const loadPdf = (selectedFile?: File) => {
    if (!selectedFile) return

    const isPdf =
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      setError('El archivo seleccionado no es un PDF. Intenta con un archivo .pdf.')
      return
    }

    setError('')
    setFile(selectedFile)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    loadPdf(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    loadPdf(event.dataTransfer.files?.[0])
  }

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectFile()
    }
  }

  const clearFile = () => {
    setFile(null)
    setError('')
  }

  return (
    <div className="min-h-svh overflow-hidden text-foreground">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        aria-label="Seleccionar un archivo PDF"
      />

      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#ff5a45] text-white shadow-[0_8px_24px_rgba(255,90,69,0.28)]">
              <Files className="size-[18px]" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-[-0.04em] text-slate-950">
              my<span className="text-[#ff5a45]">pdf</span>ly
            </span>
          </div>

          <Badge
            variant="outline"
            className="hidden h-8 gap-1.5 rounded-full border-emerald-200 bg-emerald-50/80 px-3 font-medium text-emerald-800 sm:inline-flex"
          >
            <LockKeyhole className="size-3.5" aria-hidden="true" />
            Procesamiento privado
          </Badge>
        </div>
      </header>

      {file ? (
        <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <Card className="gap-0 overflow-hidden rounded-2xl border-0 bg-white py-0 shadow-[0_28px_80px_rgba(39,45,76,0.12)] ring-1 ring-slate-200/90">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0ed] text-[#ef4935]">
                  <FileText className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-sm font-semibold text-slate-950 sm:text-base">
                    {file.name}
                  </CardTitle>
                  <CardDescription className="mt-0.5 flex items-center gap-1.5 text-xs">
                    {formatFileSize(file.size)}
                    <span aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Check className="size-3" aria-hidden="true" /> Listo para editar
                    </span>
                  </CardDescription>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden rounded-lg sm:inline-flex"
                  onClick={selectFile}
                >
                  <UploadCloud data-icon="inline-start" />
                  Cambiar PDF
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-lg text-slate-500 hover:text-slate-950"
                  onClick={clearFile}
                  aria-label="Cerrar PDF"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Suspense
                fallback={
                  <div className="editor-state min-h-[32rem] bg-[#eef0f5]">
                    Preparando el editor…
                  </div>
                }
              >
                <PdfEditor
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  file={file}
                />
              </Suspense>
            </CardContent>

            <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
                Este archivo permanece en tu dispositivo.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg sm:hidden"
                onClick={selectFile}
              >
                <UploadCloud data-icon="inline-start" />
                Cambiar PDF
              </Button>
            </CardFooter>
          </Card>
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[0.92fr_1.08fr] lg:gap-20 lg:px-8 lg:py-20">
          <section className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <Badge className="mb-6 h-7 gap-1.5 rounded-full bg-[#fff0ed] px-3 font-medium text-[#c83625] shadow-none hover:bg-[#fff0ed]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Tu espacio de trabajo PDF
            </Badge>
            <h1 className="text-balance text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-[4.6rem]">
              Tus PDFs, listos para trabajar.
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-pretty text-base leading-7 text-slate-600 sm:text-lg lg:mx-0">
              Sube un documento y visualízalo al instante. Sin cuentas, sin esperas y sin que tu archivo salga de tu navegador.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4 text-sm text-slate-700 sm:flex-row sm:gap-7 lg:justify-start">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                100% privado
              </div>
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <Zap className="size-4" aria-hidden="true" />
                </span>
                Vista instantánea
              </div>
            </div>
          </section>

          <section className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-labelledby="upload-title">
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-[#dce2ff]/55 blur-3xl" />
            <Card className="gap-0 rounded-[1.75rem] border-0 bg-white py-0 shadow-[0_30px_90px_rgba(43,50,87,0.14)] ring-1 ring-slate-200/80">
              <CardHeader className="px-5 pt-6 pb-4 text-center sm:px-8 sm:pt-8">
                <CardTitle id="upload-title" className="text-xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-2xl">
                  Abre tu primer PDF
                </CardTitle>
                <CardDescription className="mt-1 text-sm sm:text-base">
                  Selecciónalo o arrástralo a esta ventana
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 pb-5 sm:px-8 sm:pb-8">
                <div
                  role="button"
                  tabIndex={0}
                  className={`upload-zone group ${isDragging ? 'upload-zone--active' : ''}`}
                  onClick={selectFile}
                  onKeyDown={handleUploadKeyDown}
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
                  aria-label="Arrastra un PDF aquí o presiona para seleccionarlo"
                >
                  <div className="relative grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#ed4c38] transition-transform duration-300 group-hover:-translate-y-1">
                    <FileText className="size-9" strokeWidth={1.7} aria-hidden="true" />
                    <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
                      <UploadCloud className="size-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-base font-semibold text-slate-950 sm:text-lg">Suelta tu PDF aquí</p>
                    <p className="mt-1 text-sm text-slate-500">o búscalo en tu dispositivo</p>
                  </div>

                  <Button
                    size="lg"
                    className="mt-6 h-11 rounded-xl bg-slate-950 px-5 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    onClick={(event) => {
                      event.stopPropagation()
                      selectFile()
                    }}
                  >
                    <MousePointer2 data-icon="inline-start" />
                    Seleccionar PDF
                  </Button>

                  <p className="mt-5 text-xs text-slate-400">Solo archivos PDF</p>
                </div>

                {error && (
                  <Alert variant="destructive" className="mt-4 border-red-200 bg-red-50 px-3 py-2.5">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>Archivo no compatible</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>

              <CardFooter className="justify-center gap-2 rounded-b-[1.75rem] border-t border-slate-100 bg-slate-50/80 px-5 py-4 text-center text-xs text-slate-500">
                <Eye className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
                Tu documento se procesa localmente y nunca se sube a un servidor.
              </CardFooter>
            </Card>
          </section>
        </main>
      )}
    </div>
  )
}

export default App
