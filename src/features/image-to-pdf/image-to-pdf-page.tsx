import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  FileImage,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  RotateCw,
  ShieldCheck,
  Trash2,
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
import { formatFileSize } from '@/lib/files/format-file-size'
import {
  IMAGE_ACCEPT,
  MAX_IMAGE_COUNT,
  MAX_IMAGE_SIZE_BYTES,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
  moveImage,
  removeImage,
  rotateImage,
  type ImageDocumentItem,
  validateImageFile,
} from './core/document'

type ImageToPdfPageProps = {
  readonly homeHref?: string
}

const readImageDimensions = async (file: File) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    try {
      return { height: bitmap.height, width: bitmap.width }
    } finally {
      bitmap.close()
    }
  }

  const previewUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    return await new Promise<{ height: number; width: number }>((resolve, reject) => {
      image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth })
      image.onerror = () => reject(new Error('La imagen no se pudo decodificar.'))
      image.src = previewUrl
    })
  } finally {
    URL.revokeObjectURL(previewUrl)
  }
}

const createImageDocumentItem = async (file: File): Promise<ImageDocumentItem> => {
  const previewUrl = URL.createObjectURL(file)
  try {
    const dimensions = await readImageDimensions(file)
    return {
      file,
      height: dimensions.height,
      id: crypto.randomUUID(),
      previewUrl,
      rotation: 0,
      width: dimensions.width,
    }
  } catch (error) {
    URL.revokeObjectURL(previewUrl)
    throw error
  }
}

const formatImageLimits = () =>
  `Hasta ${MAX_IMAGE_COUNT} imágenes · ${formatFileSize(MAX_IMAGE_SIZE_BYTES)} por imagen · ${formatFileSize(MAX_TOTAL_IMAGE_SIZE_BYTES)} en total`

export function ImageToPdfPage({ homeHref = '/' }: ImageToPdfPageProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<readonly ImageDocumentItem[]>([])
  const [items, setItems] = useState<readonly ImageDocumentItem[]>([])
  const [errors, setErrors] = useState<readonly string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const totalBytes = useMemo(
    () => items.reduce((total, item) => total + item.file.size, 0),
    [items],
  )

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    },
    [],
  )

  const openFilePicker = () => {
    if (!isReading) inputRef.current?.click()
  }

  const addFiles = async (fileList: FileList | readonly File[]) => {
    const selectedFiles = Array.from(fileList)
    if (!selectedFiles.length || isReading) return

    setIsReading(true)
    const nextItems = [...items]
    let nextTotalBytes = totalBytes
    const nextErrors: string[] = []

    for (const file of selectedFiles) {
      const validation = validateImageFile(file, {
        existingCount: nextItems.length,
        existingFiles: nextItems.map((item) => item.file),
        existingTotalBytes: nextTotalBytes,
      })

      if (!validation.valid) {
        nextErrors.push(`${file.name}: ${validation.message}`)
        continue
      }

      try {
        const item = await createImageDocumentItem(file)
        nextItems.push(item)
        nextTotalBytes += file.size
      } catch {
        nextErrors.push(`${file.name}: la imagen no se pudo leer en este navegador.`)
      }
    }

    setItems(nextItems)
    setErrors(nextErrors)
    setIsReading(false)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    void addFiles(event.dataTransfer.files)
  }

  const handleUploadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFilePicker()
    }
  }

  const removeItem = (id: string) => {
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return
    URL.revokeObjectURL(item.previewUrl)
    setItems(removeImage(items, id))
  }

  const rotateItem = (id: string) => {
    setItems(
      items.map((item) => (item.id === id ? rotateImage(item) : item)),
    )
  }

  const moveItem = (id: string, direction: -1 | 1) => {
    const currentIndex = items.findIndex((item) => item.id === id)
    setItems(moveImage(items, currentIndex, currentIndex + direction))
  }

  const clearDocument = () => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setItems([])
    setErrors([])
  }

  const handleDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    event.dataTransfer.effectAllowed = 'move'
    setDraggedId(id)
  }

  const handleDropOnItem = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }

    const fromIndex = items.findIndex((item) => item.id === draggedId)
    const toIndex = items.findIndex((item) => item.id === targetId)
    setItems(moveImage(items, fromIndex, toIndex))
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <a
          href={homeHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-950 focus-visible:text-slate-950 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al inicio
        </a>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Procesamiento local
        </span>
      </div>

      <Card className="gap-0 overflow-hidden rounded-3xl border-0 bg-white py-0 shadow-[0_28px_80px_rgba(39,45,76,0.12)] ring-1 ring-slate-200/90">
        <CardHeader className="border-b border-slate-200 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff0ed] text-[#ed4c38]">
              <FileImage className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-2xl">
                Imágenes a PDF
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-sm leading-6 sm:text-base">
                Carga tus imágenes, organiza el documento y prepara cada página antes de aplicar filtros y exportarlo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-5 py-5 sm:px-7 sm:py-7">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            onChange={handleFileChange}
            aria-label="Seleccionar imágenes para convertir a PDF"
          />

          {items.length === 0 ? (
            <div
              data-testid="image-upload-zone"
              role="button"
              tabIndex={0}
              className={`group grid min-h-80 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center outline-none transition sm:min-h-96 sm:px-8 ${
                isDragging
                  ? 'scale-[1.01] border-[#ff7867] bg-[#fff9f7] ring-4 ring-[#ff5a45]/10'
                  : 'hover:border-[#ff7867] hover:bg-[#fff9f7] focus-visible:border-[#ff7867] focus-visible:ring-4 focus-visible:ring-[#ff5a45]/10'
              } ${isReading ? 'pointer-events-none opacity-70' : ''}`}
              onClick={openFilePicker}
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
              aria-busy={isReading}
              aria-label="Seleccionar o arrastrar imágenes para convertir a PDF"
            >
              <div>
                <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] transition-transform duration-300 group-hover:-translate-y-1">
                  {isReading ? (
                    <LoaderCircle className="size-9 animate-spin" aria-hidden="true" />
                  ) : (
                    <FileImage className="size-9" strokeWidth={1.7} aria-hidden="true" />
                  )}
                  <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
                    <UploadCloud className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-6 text-lg font-semibold text-slate-950 sm:text-xl">
                  {isReading ? 'Preparando imágenes…' : 'Suelta tus imágenes aquí'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  o selecciónalas desde tu dispositivo
                </p>
                {!isReading && (
                  <Button
                    type="button"
                    size="lg"
                    className="mt-6 h-11 rounded-xl bg-slate-950 px-5 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                    onClick={(event) => {
                      event.stopPropagation()
                      openFilePicker()
                    }}
                  >
                    <ImagePlus data-icon="inline-start" aria-hidden="true" />
                    Seleccionar imágenes
                  </Button>
                )}
                <p className="mt-5 text-xs text-slate-400">
                  JPEG · PNG · WebP · AVIF · {formatImageLimits()}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Páginas del documento</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Arrastra una tarjeta o utiliza las flechas para ordenar.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl bg-white"
                onClick={openFilePicker}
                disabled={isReading}
              >
                <ImagePlus data-icon="inline-start" aria-hidden="true" />
                Añadir imágenes
              </Button>
            </div>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTitle>No se añadieron todas las imágenes</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1 pl-4">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {items.length > 0 && (
            <section aria-labelledby="image-pages-title">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="image-pages-title" className="text-base font-semibold text-slate-950">
                    {items.length} {items.length === 1 ? 'página' : 'páginas'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatFileSize(totalBytes)} · orden actual del PDF
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl text-slate-500 hover:text-red-700"
                  onClick={clearDocument}
                >
                  Vaciar documento
                </Button>
              </div>

              <div
                data-testid="image-pages-grid"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              >
                {items.map((item, index) => (
                  <article
                    key={item.id}
                    draggable
                    className={`group overflow-hidden rounded-2xl border bg-white transition ${
                      dragOverId === item.id
                        ? 'border-[#ff7867] ring-4 ring-[#ff5a45]/10'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                    onDragStart={(event) => handleDragStart(event, item.id)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverId(item.id)
                    }}
                    onDrop={(event) => handleDropOnItem(event, item.id)}
                    onDragEnd={() => {
                      setDraggedId(null)
                      setDragOverId(null)
                    }}
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100 p-3">
                      <img
                        src={item.previewUrl}
                        alt={`Vista previa de ${item.file.name}`}
                        className="max-h-full max-w-full rounded-lg object-contain shadow-sm transition-transform duration-300"
                        style={{ transform: `rotate(${item.rotation}deg)` }}
                      />
                      <span className="absolute top-3 left-3 inline-flex size-7 items-center justify-center rounded-full bg-slate-950/80 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-sm" title="Arrastrar para ordenar">
                        <GripVertical className="size-4" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="space-y-3 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.width} × {item.height} · {formatFileSize(item.file.size)}
                          {item.rotation > 0 ? ` · girada ${item.rotation}°` : ''}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-1 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => moveItem(item.id, -1)}
                            disabled={index === 0}
                            aria-label={`Mover ${item.file.name} arriba`}
                            title="Mover arriba"
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => moveItem(item.id, 1)}
                            disabled={index === items.length - 1}
                            aria-label={`Mover ${item.file.name} abajo`}
                            title="Mover abajo"
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg text-slate-500 hover:text-slate-950"
                            onClick={() => rotateItem(item.id)}
                            aria-label={`Rotar ${item.file.name}`}
                            title="Rotar 90°"
                          >
                            <RotateCw aria-hidden="true" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Eliminar ${item.file.name}`}
                          title="Eliminar imagen"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-7">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            {items.length > 0 ? (
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
            )}
            {items.length > 0
              ? 'Las páginas permanecen en el orden que elegiste.'
              : 'Tus imágenes permanecen en tu dispositivo.'}
          </p>
          <p className="text-xs text-slate-400">
            Filtros y exportación PDF estarán disponibles en el siguiente paso.
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
