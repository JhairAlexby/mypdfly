import { useEffect, useRef, useState } from 'react'
import { AlertCircle, FileText, LoaderCircle } from 'lucide-react'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

import {
  defaultBlurFormat,
  defaultShapeFormat,
  defaultSignatureFormat,
  defaultTextFormat,
} from './pdf-editor/constants'
import { EditorToolbar } from './pdf-editor/editor-toolbar'
import {
  exportEditedPdf,
  getEditedPdfFileName,
} from './pdf-editor/export-pdf'
import {
  BlurFormatToolbar,
  ShapeFormatToolbar,
  SignatureFormatToolbar,
  TextFormatToolbar,
} from './pdf-editor/format-toolbars'
import { PageOrganizerDialog } from './pdf-editor/page-organizer-dialog'
import { PdfPage } from './pdf-editor/pdf-page'
import { SignaturePad } from './pdf-editor/signature-pad'
import type {
  Annotation,
  BlurAnnotation,
  BlurFormat,
  EditorTool,
  LayerAction,
  PdfEditorProps,
  PdfPageReference,
  PdfSource,
  ShapeAnnotation,
  ShapeFormat,
  SignatureAnnotation,
  SignatureFormat,
  SignatureTemplate,
  TextAnnotation,
  TextDraft,
  TextFormat,
} from './pdf-editor/types'
import {
  getNextLayer,
  isShapeAnnotation,
} from './pdf-editor/utils'

GlobalWorkerOptions.workerSrc = pdfWorker

export function PdfEditor({
  initialFile,
  onSummaryChange,
}: PdfEditorProps) {
  const additionalLoadingTasksRef = useRef<Set<PDFDocumentLoadingTask>>(new Set())
  const isMountedRef = useRef(true)
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([])
  const [orderedPages, setOrderedPages] = useState<PdfPageReference[]>([])
  const [loadError, setLoadError] = useState('')
  const [organizerError, setOrganizerError] = useState('')
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [isAddingPdfs, setIsAddingPdfs] = useState(false)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [targetPosition, setTargetPosition] = useState('1')
  const [organizerAnnouncement, setOrganizerAnnouncement] = useState('')
  const [activeTool, setActiveTool] = useState<EditorTool>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [currentTextFormat, setCurrentTextFormat] =
    useState<TextFormat>(defaultTextFormat)
  const [currentShapeFormat, setCurrentShapeFormat] =
    useState<ShapeFormat>(defaultShapeFormat)
  const [currentBlurFormat, setCurrentBlurFormat] =
    useState<BlurFormat>(defaultBlurFormat)
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false)
  const [signatureTemplate, setSignatureTemplate] =
    useState<SignatureTemplate | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null

    const loadPdf = async () => {
      const buffer = await initialFile.arrayBuffer()
      if (cancelled) return

      loadingTask = getDocument({ data: new Uint8Array(buffer) })
      const document = await loadingTask.promise

      if (cancelled) {
        await loadingTask.destroy()
        return
      }

      const sourceId = crypto.randomUUID()
      const source: PdfSource = {
        id: sourceId,
        file: initialFile,
        document,
      }
      const pages = Array.from({ length: document.numPages }, (_, index) => ({
        id: crypto.randomUUID(),
        sourceId,
        sourcePageNumber: index + 1,
      }))

      setPdfSources([source])
      setOrderedPages(pages)
      setSelectedPageId(pages[0]?.id ?? null)
    }

    void loadPdf().catch(() => {
      if (!cancelled) {
        setLoadError('No pudimos abrir este PDF. Puede estar dañado o protegido.')
      }
    })

    return () => {
      cancelled = true
      void loadingTask?.destroy()
    }
  }, [initialFile])

  useEffect(() => {
    isMountedRef.current = true
    const loadingTasks = additionalLoadingTasksRef.current

    return () => {
      isMountedRef.current = false
      loadingTasks.forEach((task) => {
        void task.destroy()
      })
    }
  }, [])

  useEffect(() => {
    if (!pdfSources.length) return

    onSummaryChange?.({
      fileCount: pdfSources.length,
      pageCount: orderedPages.length,
      totalSize: pdfSources.reduce(
        (total, source) => total + source.file.size,
        0,
      ),
    })
  }, [onSummaryChange, orderedPages.length, pdfSources])

  const sourcesById = new Map(
    pdfSources.map((source) => [source.id, source]),
  )

  const selectOrganizerPage = (pageId: string) => {
    const pageIndex = orderedPages.findIndex((page) => page.id === pageId)
    setSelectedPageId(pageId)
    setTargetPosition(String(Math.max(pageIndex + 1, 1)))
  }

  const addPdfFiles = async (files: File[]) => {
    if (!files.length || isAddingPdfs) return

    const validFiles = files.filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf'),
    )
    const invalidFiles = files.filter((file) => !validFiles.includes(file))

    setOrganizerError('')
    if (!validFiles.length) {
      setOrganizerError('Selecciona uno o varios archivos PDF válidos.')
      return
    }

    setIsAddingPdfs(true)

    const results = await Promise.allSettled(
      validFiles.map(async (file) => {
        const sourceId = crypto.randomUUID()
        const buffer = await file.arrayBuffer()
        const loadingTask = getDocument({ data: new Uint8Array(buffer) })
        additionalLoadingTasksRef.current.add(loadingTask)

        try {
          const document = await loadingTask.promise
          if (!isMountedRef.current) {
            throw new Error('Editor cerrado')
          }

          return {
            source: { id: sourceId, file, document } satisfies PdfSource,
            pages: Array.from({ length: document.numPages }, (_, index) => ({
              id: crypto.randomUUID(),
              sourceId,
              sourcePageNumber: index + 1,
            })),
          }
        } catch (error) {
          additionalLoadingTasksRef.current.delete(loadingTask)
          void loadingTask.destroy()
          throw error
        }
      }),
    )

    if (!isMountedRef.current) return

    const loaded = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    )
    const failedNames = validFiles.flatMap((file, index) =>
      results[index]?.status === 'rejected' ? [file.name] : [],
    )

    if (loaded.length) {
      const newPages = loaded.flatMap((result) => result.pages)
      setPdfSources((current) => [
        ...current,
        ...loaded.map((result) => result.source),
      ])
      setOrderedPages((current) => [...current, ...newPages])
      setSelectedPageId(newPages[0]?.id ?? selectedPageId)
      setTargetPosition(String(orderedPages.length + 1))
      setOrganizerAnnouncement(
        `${loaded.length} ${loaded.length === 1 ? 'PDF agregado' : 'PDFs agregados'} al final del documento.`,
      )
    }

    const rejectedNames = [
      ...invalidFiles.map((file) => file.name),
      ...failedNames,
    ]
    if (rejectedNames.length) {
      setOrganizerError(
        `No se ${rejectedNames.length === 1 ? 'pudo abrir' : 'pudieron abrir'}: ${rejectedNames.join(', ')}. Los demás documentos se conservaron.`,
      )
    }

    setIsAddingPdfs(false)
  }

  const handleOrganizerOpenChange = (open: boolean) => {
    if (!open && isAddingPdfs) return
    setOrganizerOpen(open)
  }

  const movePage = (pageId: string, requestedPosition: number) => {
    const fromIndex = orderedPages.findIndex((page) => page.id === pageId)
    if (fromIndex < 0 || !Number.isFinite(requestedPosition)) return

    const toIndex = Math.max(
      0,
      Math.min(orderedPages.length - 1, Math.trunc(requestedPosition) - 1),
    )
    const page = orderedPages[fromIndex]
    if (!page) return

    setOrderedPages((current) => {
      const currentFromIndex = current.findIndex((item) => item.id === pageId)
      if (currentFromIndex < 0) return current

      const next = [...current]
      const [movedPage] = next.splice(currentFromIndex, 1)
      if (!movedPage) return current
      next.splice(toIndex, 0, movedPage)
      return next
    })

    const source = sourcesById.get(page.sourceId)
    const finalPosition = toIndex + 1
    setSelectedPageId(pageId)
    setTargetPosition(String(finalPosition))
    setOrganizerAnnouncement(
      `${source?.file.name ?? 'Página'}, página original ${page.sourcePageNumber}, movida a la posición ${finalPosition}.`,
    )
  }

  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) ??
    null
  const selectedText =
    selectedAnnotation?.type === 'text' ? selectedAnnotation : null
  const selectedShape =
    selectedAnnotation && isShapeAnnotation(selectedAnnotation)
      ? selectedAnnotation
      : null
  const selectedBlur =
    selectedAnnotation?.type === 'blur' ? selectedAnnotation : null
  const selectedSignature =
    selectedAnnotation?.type === 'signature' ? selectedAnnotation : null
  const activeTextFormat =
    textDraft?.format ?? selectedText?.format ?? currentTextFormat
  const activeShapeFormat = selectedShape?.format ?? currentShapeFormat
  const activeBlurFormat = selectedBlur?.format ?? currentBlurFormat
  const showTextFormatter =
    activeTool === 'text' || Boolean(textDraft) || Boolean(selectedText)
  const shapeToolActive =
    activeTool !== null &&
    activeTool !== 'text' &&
    activeTool !== 'blur' &&
    activeTool !== 'signature'
  const showShapeFormatter = shapeToolActive || Boolean(selectedShape)
  const showBlurFormatter = activeTool === 'blur' || Boolean(selectedBlur)
  const showSignatureFormatter = Boolean(selectedSignature)

  const selectAnnotation = (id: string | null) => {
    setSelectedAnnotationId(id)
    if (!id) return

    const annotation = annotations.find((item) => item.id === id)
    if (annotation?.type === 'text') {
      setCurrentTextFormat(annotation.format)
    } else if (annotation?.type === 'blur') {
      setCurrentBlurFormat(annotation.format)
    } else if (annotation && isShapeAnnotation(annotation)) {
      setCurrentShapeFormat(annotation.format)
    }
  }

  const applyTextFormat = (patch: Partial<TextFormat>) => {
    setCurrentTextFormat((current) => ({ ...current, ...patch }))
    setTextDraft((current) =>
      current
        ? { ...current, format: { ...current.format, ...patch } }
        : current,
    )

    if (selectedText) {
      setAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === selectedText.id && annotation.type === 'text'
            ? { ...annotation, format: { ...annotation.format, ...patch } }
            : annotation,
        ),
      )
    }
  }

  const applyShapeFormat = (patch: Partial<ShapeFormat>) => {
    setCurrentShapeFormat((current) => ({ ...current, ...patch }))

    if (selectedShape) {
      setAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === selectedShape.id && isShapeAnnotation(annotation)
            ? { ...annotation, format: { ...annotation.format, ...patch } }
            : annotation,
        ),
      )
    }
  }

  const applyBlurFormat = (patch: Partial<BlurFormat>) => {
    setCurrentBlurFormat((current) => ({ ...current, ...patch }))

    if (selectedBlur) {
      setAnnotations((current) =>
        current.map((annotation) =>
          annotation.id === selectedBlur.id && annotation.type === 'blur'
            ? { ...annotation, format: { ...annotation.format, ...patch } }
            : annotation,
        ),
      )
    }
  }

  const applySignatureFormat = (patch: Partial<SignatureFormat>) => {
    if (!selectedSignature) return

    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === selectedSignature.id && annotation.type === 'signature'
          ? { ...annotation, format: { ...annotation.format, ...patch } }
          : annotation,
      ),
    )
  }

  const commitText = (draft: TextDraft) => {
    const text = draft.value.trim()

    if (draft.annotationId) {
      if (text) {
        setAnnotations((current) =>
          current.map((annotation) =>
            annotation.id === draft.annotationId && annotation.type === 'text'
              ? { ...annotation, text, format: draft.format }
              : annotation,
          ),
        )
        setSelectedAnnotationId(draft.annotationId)
      } else {
        setAnnotations((current) =>
          current.filter((annotation) => annotation.id !== draft.annotationId),
        )
        setSelectedAnnotationId(null)
      }
    } else if (text) {
      const annotationId = crypto.randomUUID()
      setAnnotations((current) => [
        ...current,
        {
          id: annotationId,
          pageId: draft.pageId,
          type: 'text',
          x: draft.x,
          y: draft.y,
          text,
          format: draft.format,
          layer: getNextLayer(current, draft.pageId),
        },
      ])
      setSelectedAnnotationId(annotationId)
    }

    setTextDraft(null)
    setActiveTool(null)
  }

  const editText = (annotation: TextAnnotation) => {
    setSelectedAnnotationId(annotation.id)
    setActiveTool(null)
    setCurrentTextFormat(annotation.format)
    setTextDraft({
      annotationId: annotation.id,
      pageId: annotation.pageId,
      x: annotation.x,
      y: annotation.y,
      value: annotation.text,
      format: annotation.format,
    })
  }

  const addShape = (
    pageId: string,
    shape: Omit<ShapeAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => {
    const annotationId = crypto.randomUUID()
    setAnnotations((current) => [
      ...current,
      {
        ...shape,
        id: annotationId,
        pageId,
        layer: getNextLayer(current, pageId),
      },
    ])
    setSelectedAnnotationId(annotationId)
    setCurrentShapeFormat(shape.format)
    setActiveTool(null)
  }

  const addBlur = (
    pageId: string,
    blur: Omit<BlurAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => {
    const annotationId = crypto.randomUUID()
    setAnnotations((current) => [
      ...current,
      {
        ...blur,
        id: annotationId,
        pageId,
        layer: getNextLayer(current, pageId),
      },
    ])
    setSelectedAnnotationId(annotationId)
    setCurrentBlurFormat(blur.format)
    setActiveTool(null)
  }

  const addSignature = (
    pageId: string,
    signature: Omit<SignatureAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => {
    const annotationId = crypto.randomUUID()
    setAnnotations((current) => [
      ...current,
      {
        ...signature,
        id: annotationId,
        pageId,
        layer: getNextLayer(current, pageId),
      },
    ])
    setSelectedAnnotationId(annotationId)
    setActiveTool(null)
  }

  const updateAnnotation = (updatedAnnotation: Annotation) => {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation,
      ),
    )
  }

  const changeSelectedAnnotationLayer = (action: LayerAction) => {
    const selectedArea = selectedShape ?? selectedBlur ?? selectedSignature
    if (!selectedArea) return

    setAnnotations((current) => {
      const pageAnnotations = current
        .filter((annotation) => annotation.pageId === selectedArea.pageId)
        .sort((first, second) => first.layer - second.layer)
      const currentIndex = pageAnnotations.findIndex(
        (annotation) => annotation.id === selectedArea.id,
      )

      if (currentIndex < 0) return current

      const targetIndex =
        action === 'front'
          ? pageAnnotations.length - 1
          : action === 'back'
            ? 0
            : action === 'forward'
              ? Math.min(currentIndex + 1, pageAnnotations.length - 1)
              : Math.max(currentIndex - 1, 0)

      if (targetIndex === currentIndex) return current

      const [movedAnnotation] = pageAnnotations.splice(currentIndex, 1)
      if (!movedAnnotation) return current
      pageAnnotations.splice(targetIndex, 0, movedAnnotation)

      const layersById = new Map(
        pageAnnotations.map((annotation, index) => [annotation.id, index + 1]),
      )

      return current.map((annotation) =>
        annotation.pageId === selectedArea.pageId
          ? {
              ...annotation,
              layer: layersById.get(annotation.id) ?? annotation.layer,
            }
          : annotation,
      )
    })
  }

  const removeSelectedAnnotation = () => {
    if (!selectedAnnotationId) return
    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== selectedAnnotationId),
    )
    setSelectedAnnotationId(null)
    setTextDraft(null)
  }

  const getAnnotationsForExport = () => {
    if (!textDraft) return annotations

    const text = textDraft.value.trim()
    if (textDraft.annotationId) {
      if (!text) {
        return annotations.filter(
          (annotation) => annotation.id !== textDraft.annotationId,
        )
      }

      return annotations.map((annotation) =>
        annotation.id === textDraft.annotationId && annotation.type === 'text'
          ? { ...annotation, text, format: textDraft.format }
          : annotation,
      )
    }

    if (!text) return annotations

    return [
      ...annotations,
      {
        id: crypto.randomUUID(),
        pageId: textDraft.pageId,
        type: 'text' as const,
        x: textDraft.x,
        y: textDraft.y,
        text,
        format: textDraft.format,
        layer: getNextLayer(annotations, textDraft.pageId),
      },
    ]
  }

  const downloadEditedPdf = async () => {
    if (isExporting || !orderedPages.length) return

    setIsExporting(true)
    setExportError('')
    setExportProgress('Preparando el documento…')

    try {
      await exportEditedPdf({
        sources: pdfSources,
        pages: orderedPages,
        annotations: getAnnotationsForExport(),
        fileName: getEditedPdfFileName(
          initialFile.name,
          pdfSources.length > 1,
        ),
        onProgress: (currentPage, totalPages) => {
          setExportProgress(`Preparando página ${currentPage} de ${totalPages}…`)
        },
      })
      setExportProgress('PDF descargado correctamente.')
    } catch (error) {
      console.error(error)
      setExportError(
        'No pudimos generar el PDF. Intenta nuevamente con el documento abierto.',
      )
      setExportProgress('')
    } finally {
      setIsExporting(false)
    }
  }

  const clearEditingSelection = () => {
    setSelectedAnnotationId(null)
    setTextDraft(null)
  }

  return (
    <div
      className={`pdf-editor ${showTextFormatter || showShapeFormatter || showBlurFormatter || showSignatureFormatter ? 'pdf-editor--context-format' : ''}`}
    >
      <PageOrganizerDialog
        open={organizerOpen}
        sources={pdfSources}
        pages={orderedPages}
        isAddingPdfs={isAddingPdfs}
        error={organizerError}
        selectedPageId={selectedPageId}
        targetPosition={targetPosition}
        announcement={organizerAnnouncement}
        onOpenChange={handleOrganizerOpenChange}
        onAddFiles={addPdfFiles}
        onMovePage={movePage}
        onSelectPage={selectOrganizerPage}
        onTargetPositionChange={setTargetPosition}
      />

      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="signature-dialog sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dibuja tu firma</DialogTitle>
            <DialogDescription>
              Usa el mouse, trackpad, lápiz o dedo como si fueran un bolígrafo.
            </DialogDescription>
          </DialogHeader>
          {signatureDialogOpen && (
            <SignaturePad
              initialFormat={signatureTemplate?.format ?? defaultSignatureFormat}
              onCancel={() => setSignatureDialogOpen(false)}
              onUse={(strokes, format) => {
                setSignatureTemplate({ strokes, format })
                setSignatureDialogOpen(false)
                clearEditingSelection()
                setActiveTool('signature')
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <EditorToolbar
        activeTool={activeTool}
        selectedAnnotation={selectedAnnotation}
        hasPages={Boolean(orderedPages.length)}
        isExporting={isExporting}
        onToggleText={() => {
          setActiveTool((current) => (current === 'text' ? null : 'text'))
          clearEditingSelection()
        }}
        onSelectShape={(shape) => {
          setActiveTool(shape)
          clearEditingSelection()
        }}
        onToggleBlur={() => {
          setActiveTool((current) => (current === 'blur' ? null : 'blur'))
          clearEditingSelection()
        }}
        onOpenSignature={() => {
          setActiveTool(null)
          clearEditingSelection()
          setSignatureDialogOpen(true)
        }}
        onOpenOrganizer={() => {
          setActiveTool(null)
          clearEditingSelection()
          setOrganizerOpen(true)
        }}
        onRemoveSelected={removeSelectedAnnotation}
        onDownload={() => void downloadEditedPdf()}
      />

      {exportError && (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-t-0 px-4"
        >
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}
      <p className="sr-only" aria-live="polite">
        {exportProgress}
      </p>

      <TextFormatToolbar
        visible={showTextFormatter}
        format={activeTextFormat}
        onFormatChange={applyTextFormat}
      />
      <ShapeFormatToolbar
        visible={showShapeFormatter}
        format={activeShapeFormat}
        hasSelectedShape={Boolean(selectedShape)}
        onFormatChange={applyShapeFormat}
        onLayerChange={changeSelectedAnnotationLayer}
      />
      <BlurFormatToolbar
        visible={showBlurFormatter}
        format={activeBlurFormat}
        hasSelectedBlur={Boolean(selectedBlur)}
        onFormatChange={applyBlurFormat}
        onLayerChange={changeSelectedAnnotationLayer}
      />
      <SignatureFormatToolbar
        signature={selectedSignature}
        onFormatChange={applySignatureFormat}
        onLayerChange={changeSelectedAnnotationLayer}
        onCreateAnother={() => setSignatureDialogOpen(true)}
      />

      <div className="editor-canvas-area">
        {!pdfSources.length && !loadError && (
          <div className="editor-state">
            <LoaderCircle
              className="size-7 animate-spin text-[#ff5a45]"
              aria-hidden="true"
            />
            <p>Preparando el documento…</p>
          </div>
        )}

        {loadError && (
          <div className="editor-state text-center">
            <FileText className="size-9 text-slate-400" aria-hidden="true" />
            <p className="font-medium text-slate-700">{loadError}</p>
          </div>
        )}

        {pdfSources.length > 0 && (
          <div className="pdf-pages">
            {orderedPages.map((page, index) => {
              const source = sourcesById.get(page.sourceId)
              if (!source) return null

              return (
                <PdfPage
                  key={page.id}
                  pdfDocument={source.document}
                  sourcePageNumber={page.sourcePageNumber}
                  pageId={page.id}
                  displayPageNumber={index + 1}
                  sourceName={source.file.name}
                  activeTool={activeTool}
                  textFormat={activeTextFormat}
                  shapeFormat={activeShapeFormat}
                  blurFormat={activeBlurFormat}
                  signatureTemplate={signatureTemplate}
                  annotations={annotations.filter(
                    (annotation) => annotation.pageId === page.id,
                  )}
                  selectedAnnotationId={selectedAnnotationId}
                  textDraft={textDraft}
                  onTextDraftChange={setTextDraft}
                  onCommitText={commitText}
                  onEditText={editText}
                  onAddShape={(shape) => addShape(page.id, shape)}
                  onAddBlur={(blur) => addBlur(page.id, blur)}
                  onAddSignature={(signature) =>
                    addSignature(page.id, signature)
                  }
                  onUpdateAnnotation={updateAnnotation}
                  onSelectAnnotation={selectAnnotation}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="editor-statusbar">
        <span>
          {pdfSources.length
            ? `${orderedPages.length} ${orderedPages.length === 1 ? 'página' : 'páginas'} · ${pdfSources.length} ${pdfSources.length === 1 ? 'PDF' : 'PDFs'}`
            : 'Cargando PDF'}
        </span>
        <span>
          {annotations.length}{' '}
          {annotations.length === 1
            ? 'elemento agregado'
            : 'elementos agregados'}
        </span>
      </div>
    </div>
  )
}
