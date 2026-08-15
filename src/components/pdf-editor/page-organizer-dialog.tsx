import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent as ReactDragEvent } from 'react'
import {
  Check,
  FileText,
  GripVertical,
  LoaderCircle,
  Trash2,
  UploadCloud,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { pdfSourceColors } from './constants'
import { PdfPageThumbnail } from './pdf-page'
import type { PdfPageReference, PdfSource } from './types'

export type PageOrganizerDialogProps = {
  open: boolean
  sources: PdfSource[]
  pages: PdfPageReference[]
  isAddingPdfs: boolean
  error: string
  selectedPageId: string | null
  targetPosition: string
  announcement: string
  onOpenChange: (open: boolean) => void
  onAddFiles: (files: File[]) => void | Promise<void>
  onMovePage: (pageId: string, position: number) => void
  onRequestRemovePage: (pageId: string) => void
  onSelectPage: (pageId: string) => void
  onTargetPositionChange: (value: string) => void
}

export function PageOrganizerDialog({
  open,
  sources,
  pages,
  isAddingPdfs,
  error,
  selectedPageId,
  targetPosition,
  announcement,
  onOpenChange,
  onAddFiles,
  onMovePage,
  onRequestRemovePage,
  onSelectPage,
  onTargetPositionChange,
}: PageOrganizerDialogProps) {
  const addPdfInputRef = useRef<HTMLInputElement>(null)
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [dropTargetPageId, setDropTargetPageId] = useState<string | null>(null)

  const sourcesById = new Map(sources.map((source) => [source.id, source]))
  const selectedPageIndex = selectedPageId
    ? pages.findIndex((page) => page.id === selectedPageId)
    : -1

  const handleAdditionalPdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void onAddFiles(files)
  }

  const moveSelectedPage = (position: number) => {
    if (!selectedPageId) return
    onMovePage(selectedPageId, position)
  }

  const handlePageDrop = (
    event: ReactDragEvent<HTMLElement>,
    targetPageId: string,
  ) => {
    event.preventDefault()
    const pageId = draggedPageId ?? event.dataTransfer.getData('text/plain')
    const targetIndex = pages.findIndex((page) => page.id === targetPageId)

    if (pageId && targetIndex >= 0 && pageId !== targetPageId) {
      onMovePage(pageId, targetIndex + 1)
    }

    setDraggedPageId(null)
    setDropTargetPageId(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="page-organizer-dialog sm:max-w-5xl">
        <input
          ref={addPdfInputRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={handleAdditionalPdfChange}
          aria-label="Seleccionar PDFs para unir"
        />

        <DialogHeader>
          <DialogTitle>Unir y organizar páginas</DialogTitle>
          <DialogDescription>
            Añade uno o varios PDFs y define el orden final de todas sus páginas.
          </DialogDescription>
        </DialogHeader>

        <div className="page-organizer-summary">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">
              {sources.length} {sources.length === 1 ? 'archivo' : 'archivos'}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {pages.length} {pages.length === 1 ? 'página' : 'páginas'}
            </Badge>
            <span className="text-xs text-slate-500">
              Arrastra o usa los controles de posición. Los cambios se aplican
              al instante.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAddingPdfs}
            onClick={() => addPdfInputRef.current?.click()}
          >
            {isAddingPdfs ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : (
              <UploadCloud data-icon="inline-start" />
            )}
            {isAddingPdfs ? 'Agregando…' : 'Agregar PDFs'}
          </Button>
        </div>

        {error && (
          <div className="page-organizer-error" role="alert">
            <FileText aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="page-organizer-scroll">
          <div className="page-organizer-grid">
            {pages.map((page, index) => {
              const source = sourcesById.get(page.sourceId)
              if (!source) return null

              const sourceIndex = sources.findIndex(
                (item) => item.id === source.id,
              )
              const isSelected = page.id === selectedPageId
              const isDropTarget = page.id === dropTargetPageId

              return (
                <article
                  key={page.id}
                  className={[
                    'page-organizer-card',
                    isSelected && 'page-organizer-card--selected',
                    draggedPageId === page.id &&
                      'page-organizer-card--dragging',
                    isDropTarget && 'page-organizer-card--drop-target',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (draggedPageId && draggedPageId !== page.id) {
                      setDropTargetPageId(page.id)
                    }
                  }}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node,
                      )
                    ) {
                      setDropTargetPageId((current) =>
                        current === page.id ? null : current,
                      )
                    }
                  }}
                  onDrop={(event) => handlePageDrop(event, page.id)}
                >
                  <div className="page-organizer-card-header">
                    <Badge className="page-position-badge">{index + 1}</Badge>
                    <div className="page-organizer-card-tools">
                      <button
                        type="button"
                        className="page-drag-handle"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', page.id)
                          setDraggedPageId(page.id)
                          onSelectPage(page.id)
                        }}
                        onClick={() => onSelectPage(page.id)}
                        onDragEnd={() => {
                          setDraggedPageId(null)
                          setDropTargetPageId(null)
                        }}
                        aria-label={`Seleccionar página ${index + 1} para moverla`}
                        title="Arrastra o selecciona y usa los controles inferiores"
                      >
                        <GripVertical aria-hidden="true" />
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="page-delete-button"
                        disabled={pages.length <= 1 || isAddingPdfs}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRequestRemovePage(page.id)
                        }}
                        aria-label={`Eliminar página ${index + 1}`}
                        title={
                          pages.length <= 1
                            ? 'Debe quedar al menos una página'
                            : 'Eliminar página'
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="page-organizer-preview"
                    onClick={() => onSelectPage(page.id)}
                    aria-pressed={isSelected}
                    aria-label={`Seleccionar página ${index + 1}, página original ${page.sourcePageNumber} de ${source.file.name}`}
                  >
                    <PdfPageThumbnail
                      document={source.document}
                      pageNumber={page.sourcePageNumber}
                    />
                  </button>

                  <div className="page-organizer-card-footer">
                    <span
                      className="page-source-dot"
                      style={{
                        backgroundColor:
                          pdfSourceColors[
                            Math.max(sourceIndex, 0) % pdfSourceColors.length
                          ],
                      }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <strong title={source.file.name}>{source.file.name}</strong>
                      <small>Pág. original {page.sourcePageNumber}</small>
                    </span>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>

        <DialogFooter className="page-organizer-footer sm:justify-between">
          <div className="page-organizer-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedPageIndex <= 0}
              onClick={() => moveSelectedPage(1)}
            >
              Al inicio
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedPageIndex <= 0}
              onClick={() => moveSelectedPage(selectedPageIndex)}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                selectedPageIndex < 0 ||
                selectedPageIndex >= pages.length - 1
              }
              onClick={() => moveSelectedPage(selectedPageIndex + 2)}
            >
              Siguiente
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                selectedPageIndex < 0 ||
                selectedPageIndex >= pages.length - 1
              }
              onClick={() => moveSelectedPage(pages.length)}
            >
              Al final
            </Button>
            <label className="page-position-control">
              <span>Posición</span>
              <Input
                type="number"
                min={1}
                max={pages.length}
                inputMode="numeric"
                value={targetPosition}
                onChange={(event) =>
                  onTargetPositionChange(event.target.value)
                }
                aria-label="Nueva posición de la página"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={!selectedPageId || !targetPosition}
              onClick={() => moveSelectedPage(Number(targetPosition))}
            >
              Mover
            </Button>
          </div>
          <Button
            type="button"
            disabled={isAddingPdfs}
            onClick={() => onOpenChange(false)}
          >
            <Check data-icon="inline-start" />
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
