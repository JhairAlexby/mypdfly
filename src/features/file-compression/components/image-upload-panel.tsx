import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  AlertCircle,
  Image as ImageIcon,
  LoaderCircle,
  MousePointer2,
  UploadCloud,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { ImageSelectionState } from '@/features/file-compression/hooks/use-image-compression'
import { cn } from '@/lib/utils'

type PendingImageSelection = Exclude<
  ImageSelectionState,
  { readonly status: 'ready' }
>

type ImageUploadPanelProps = {
  selection: PendingImageSelection
  onSelectFile: (file: File) => void
}

export function ImageUploadPanel({
  selection,
  onSelectFile,
}: ImageUploadPanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isInspecting = selection.status === 'inspecting'

  const openFilePicker = () => {
    if (!isInspecting) inputRef.current?.click()
  }

  const receiveFile = (file?: File) => {
    if (file && !isInspecting) onSelectFile(file)
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
    <div className="mx-auto max-w-3xl">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={handleInputChange}
      />

      <div
        role="group"
        className={cn(
          'group grid min-h-72 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center outline-none transition sm:min-h-80 sm:px-8',
          'hover:border-[#ff7867] hover:bg-[#fff9f7]',
          isDragging && 'scale-[1.01] border-[#ff7867] bg-[#fff9f7] ring-4 ring-[#ff5a45]/10',
          isInspecting && 'pointer-events-none',
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
        aria-busy={isInspecting}
        aria-label="Carga de imagen JPEG o PNG"
      >
        <div>
          <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] transition-transform duration-300 group-hover:-translate-y-1">
            {isInspecting ? (
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
              {isInspecting
                ? 'Inspeccionando imagen…'
                : 'Suelta tu JPEG o PNG aquí'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isInspecting ? selection.file.name : 'o búscalo en tu dispositivo'}
            </p>
          </div>

          {!isInspecting && (
            <Button
              size="lg"
              className="mt-6 h-11 rounded-xl bg-slate-950 px-5 text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800"
              onClick={(event) => {
                event.stopPropagation()
                openFilePicker()
              }}
            >
              <MousePointer2 data-icon="inline-start" aria-hidden="true" />
              Seleccionar imagen
            </Button>
          )}

          <p className="mt-5 text-xs text-slate-400">
            Un archivo .jpg, .jpeg o .png a la vez
          </p>
        </div>
      </div>

      {selection.status === 'error' && (
        <Alert
          variant="destructive"
          className="mt-4 border-red-200 bg-red-50 px-3 py-2.5"
        >
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Archivo no compatible</AlertTitle>
          <AlertDescription>{selection.message}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
