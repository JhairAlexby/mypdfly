import { useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react'
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFilePicker()
    }
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={COMPRESSION_FILE_ACCEPT}
        multiple
        className="sr-only"
        onChange={handleInputChange}
        aria-label="Seleccionar archivos para comprimir"
      />

      <div
        role="button"
        tabIndex={0}
        className={cn(
          'upload-zone group',
          isDragging && 'upload-zone--active',
          isInspecting && 'pointer-events-none opacity-70',
        )}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
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
        aria-label="Seleccionar o arrastrar archivos para comprimir"
      >
        <div className="relative grid size-20 place-items-center rounded-2xl bg-[#fff0ed] text-[#ed4c38] transition-transform duration-300 group-hover:-translate-y-1">
          {isInspecting ? (
            <LoaderCircle className="size-9 animate-spin" aria-hidden="true" />
          ) : (
            <FileStack className="size-9" strokeWidth={1.7} aria-hidden="true" />
          )}
          <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full border-4 border-white bg-[#ff5a45] text-white">
            <UploadCloud className="size-4" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-5">
          <p className="text-base font-semibold text-slate-950 sm:text-lg">
            {isInspecting
              ? 'Inspeccionando archivos…'
              : 'Suelta tus archivos aquí'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            o búscalos en tu dispositivo
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
          PDF, JPEG, PNG, WebP o AVIF (hasta 50 MB)
        </p>
      </div>
    </div>
  )
}
