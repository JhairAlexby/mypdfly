import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  FileStack,
  LoaderCircle,
  MousePointer2,
  UploadCloud,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { COMPRESSION_FILE_ACCEPT } from '@/features/file-compression/file-accept'
import { cn } from '@/lib/utils'

type FileUploadPanelProps = {
  isInspecting: boolean
  onSelectFiles: (files: readonly File[]) => void
}

export function FileUploadPanel({
  isInspecting,
  onSelectFiles,
}: FileUploadPanelProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const openFilePicker = () => {
    if (!isInspecting) inputRef.current?.click()
  }

  const receiveFiles = (files?: FileList | null) => {
    if (!isInspecting && files?.length) {
      onSelectFiles(Array.from(files))
    }
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    receiveFiles(event.currentTarget.files)
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    receiveFiles(event.dataTransfer.files)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={COMPRESSION_FILE_ACCEPT}
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        role="group"
        className={cn(
          'group grid min-h-72 cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-5 py-10 text-center outline-none transition sm:min-h-80 sm:px-8',
          'hover:border-[#ff7867] hover:bg-[#fff9f7] focus-visible:border-[#ff7867] focus-visible:ring-4 focus-visible:ring-[#ff5a45]/10',
          isDragging &&
            'scale-[1.01] border-[#ff7867] bg-[#fff9f7] ring-4 ring-[#ff5a45]/10',
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
        aria-label="Seleccionar archivos PDF o imágenes para comprimir"
      >
        <div>
          <div className="relative mx-auto grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#e84c38] transition-transform duration-300 group-hover:-translate-y-1">
            {isInspecting ? (
              <LoaderCircle className="size-9 animate-spin" aria-hidden="true" />
            ) : (
              <FileStack className="size-9" strokeWidth={1.7} aria-hidden="true" />
            )}
            <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
              <UploadCloud className="size-4" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-6">
            <p className="text-lg font-semibold text-slate-950 sm:text-xl">
              {isInspecting
                ? 'Inspeccionando archivos…'
                : 'Suelta tus archivos aquí'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              PDF de hasta 50 MB, JPEG, PNG, WebP o AVIF estático
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
              Seleccionar archivos
            </Button>
          )}

          <p className="mt-5 text-xs text-slate-400">
            Puedes elegir uno o varios; el procesamiento será secuencial
          </p>
        </div>
      </div>
    </div>
  )
}
