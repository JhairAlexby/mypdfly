import { useEffect, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

import { BlurMark, ShapeMark, SignatureMark } from './annotation-marks'
import type {
  AnnotationInteraction,
  AreaAnnotation,
  AreaDraft,
  PdfPageProps,
  PdfPageThumbnailProps,
  Point,
  ResizeHandle,
  TextAnnotation,
} from './types'
import {
  clamp,
  getPoint,
  getTextRenderStyle,
  isBlurAnnotation,
  isShapeAnnotation,
  isSignatureAnnotation,
  isTextAnnotation,
  normalizeArea,
} from './utils'

export function PdfPage({
  pdfDocument,
  sourcePageNumber,
  pageId,
  displayPageNumber,
  sourceName,
  activeTool,
  textFormat,
  shapeFormat,
  blurFormat,
  signatureTemplate,
  annotations,
  selectedAnnotationId,
  textDraft,
  onTextDraftChange,
  onCommitText,
  onEditText,
  onAddShape,
  onAddBlur,
  onAddSignature,
  onUpdateAnnotation,
  onSelectAnnotation,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null)
  const [aspectRatio, setAspectRatio] = useState(8.5 / 11)
  const [pageWidth, setPageWidth] = useState(612)
  const [areaDraft, setAreaDraft] = useState<AreaDraft | null>(null)
  const [interaction, setInteraction] =
    useState<AnnotationInteraction | null>(null)

  useEffect(() => {
    let cancelled = false

    void pdfDocument.getPage(sourcePageNumber).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale: 1 })
      setAspectRatio(viewport.width / viewport.height)
      setPageWidth(viewport.width)
      setPdfPage(page)
    })

    return () => {
      cancelled = true
    }
  }, [sourcePageNumber, pdfDocument])

  useEffect(() => {
    if (!pdfPage || !pageRef.current || !canvasRef.current) return

    const pageElement = pageRef.current
    const canvas = canvasRef.current
    let renderTask: RenderTask | null = null

    const renderPage = () => {
      const width = pageElement.clientWidth
      if (!width) return

      renderTask?.cancel()

      const baseViewport = pdfPage.getViewport({ scale: 1 })
      const viewport = pdfPage.getViewport({ scale: width / baseViewport.width })
      const outputScale = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      renderTask = pdfPage.render({
        canvas,
        viewport,
        transform:
          outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
      })

      void renderTask.promise.catch((renderError: unknown) => {
        if (
          renderError instanceof Error &&
          renderError.name !== 'RenderingCancelledException'
        ) {
          console.error(renderError)
        }
      })
    }

    const resizeObserver = new ResizeObserver(renderPage)
    resizeObserver.observe(pageElement)
    renderPage()

    return () => {
      resizeObserver.disconnect()
      renderTask?.cancel()
    }
  }, [pdfPage])

  const handlePagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pageRef.current || event.button !== 0) return

    if (!activeTool) {
      onSelectAnnotation(null)
      return
    }

    if (activeTool === 'text') return

    const point = getPoint(event, pageRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectAnnotation(null)
    setAreaDraft(
      activeTool === 'blur'
        ? {
            type: 'blur',
            start: point,
            end: point,
            format: blurFormat,
          }
        : activeTool === 'signature' && signatureTemplate
          ? {
              type: 'signature',
              start: point,
              end: point,
              strokes: signatureTemplate.strokes,
              format: signatureTemplate.format,
            }
          : activeTool !== 'signature'
            ? {
                type: activeTool,
                start: point,
                end: point,
                format: shapeFormat,
              }
            : null,
    )
  }

  const handlePageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'text' || !pageRef.current || textDraft) return

    const point = getPoint(event, pageRef.current)
    onSelectAnnotation(null)
    onTextDraftChange({
      annotationId: null,
      pageId,
      x: Math.min(point.x, 0.72),
      y: Math.min(point.y, 0.94),
      value: '',
      format: textFormat,
    })
  }

  const startAreaMove = (
    event: ReactPointerEvent<Element>,
    annotation: AreaAnnotation,
  ) => {
    if (!pageRef.current) return
    onSelectAnnotation(annotation.id)
    setInteraction({
      kind: 'area-move',
      annotation,
      origin: getPoint(event, pageRef.current),
    })
  }

  const startAreaResize = (
    _event: ReactPointerEvent<Element>,
    annotation: AreaAnnotation,
    handle: ResizeHandle,
  ) => {
    onSelectAnnotation(annotation.id)
    setInteraction({
      kind: 'area-resize',
      annotation,
      handle,
    })
  }

  const startTextMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
    annotation: TextAnnotation,
  ) => {
    if (!pageRef.current || event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectAnnotation(annotation.id)
    setInteraction({
      kind: 'text-move',
      annotation,
      origin: getPoint(event, pageRef.current),
    })
  }

  const moveArea = (
    interactionState: Extract<AnnotationInteraction, { kind: 'area-move' }>,
    point: Point,
  ) => {
    const { annotation, origin } = interactionState
    const minX = Math.min(annotation.start.x, annotation.end.x)
    const maxX = Math.max(annotation.start.x, annotation.end.x)
    const minY = Math.min(annotation.start.y, annotation.end.y)
    const maxY = Math.max(annotation.start.y, annotation.end.y)
    const deltaX = clamp(point.x - origin.x, -minX, 1 - maxX)
    const deltaY = clamp(point.y - origin.y, -minY, 1 - maxY)

    onUpdateAnnotation({
      ...annotation,
      start: {
        x: annotation.start.x + deltaX,
        y: annotation.start.y + deltaY,
      },
      end: {
        x: annotation.end.x + deltaX,
        y: annotation.end.y + deltaY,
      },
    })
  }

  const resizeArea = (
    interactionState: Extract<AnnotationInteraction, { kind: 'area-resize' }>,
    point: Point,
  ) => {
    const { annotation, handle } = interactionState
    const minimumSize = 0.02

    if (annotation.type === 'line') {
      onUpdateAnnotation({
        ...annotation,
        start: handle === 'start' ? point : annotation.start,
        end: handle === 'end' ? point : annotation.end,
      })
      return
    }

    const start = { ...annotation.start }
    const end = { ...annotation.end }

    if (handle === 'nw' || handle === 'sw') {
      start.x = Math.min(point.x, end.x - minimumSize)
    }
    if (handle === 'ne' || handle === 'se') {
      end.x = Math.max(point.x, start.x + minimumSize)
    }
    if (handle === 'nw' || handle === 'ne') {
      start.y = Math.min(point.y, end.y - minimumSize)
    }
    if (handle === 'sw' || handle === 'se') {
      end.y = Math.max(point.y, start.y + minimumSize)
    }

    onUpdateAnnotation({ ...annotation, start, end })
  }

  const moveText = (
    interactionState: Extract<AnnotationInteraction, { kind: 'text-move' }>,
    point: Point,
  ) => {
    const { annotation, origin } = interactionState
    onUpdateAnnotation({
      ...annotation,
      x: clamp(annotation.x + point.x - origin.x, 0, 0.82),
      y: clamp(annotation.y + point.y - origin.y, 0, 0.96),
    })
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pageRef.current) return
    const point = getPoint(event, pageRef.current)

    if (areaDraft) {
      setAreaDraft({ ...areaDraft, end: point })
      return
    }

    if (!interaction) return
    event.preventDefault()

    if (interaction.kind === 'area-move') moveArea(interaction, point)
    if (interaction.kind === 'area-resize') resizeArea(interaction, point)
    if (interaction.kind === 'text-move') moveText(interaction, point)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pageRef.current) return

    if (areaDraft) {
      const pointerEnd = getPoint(event, pageRef.current)
      const isTiny =
        Math.abs(pointerEnd.x - areaDraft.start.x) < 0.015 &&
        Math.abs(pointerEnd.y - areaDraft.start.y) < 0.015
      const end = isTiny
        ? {
            x: clamp(
              areaDraft.start.x +
                (areaDraft.type === 'signature' ? 0.28 : 0.18),
            ),
            y: clamp(
              areaDraft.start.y +
                (areaDraft.type === 'line'
                  ? 0.001
                  : areaDraft.type === 'signature'
                    ? 0.085
                    : 0.12),
            ),
          }
        : pointerEnd

      const normalizedArea = normalizeArea({ ...areaDraft, end })
      if (normalizedArea.type === 'blur') {
        onAddBlur(normalizedArea)
      } else if (normalizedArea.type === 'signature') {
        onAddSignature(normalizedArea)
      } else {
        onAddShape(normalizedArea)
      }
      setAreaDraft(null)
    }

    if (interaction) setInteraction(null)
  }

  const pageClassName = [
    'editor-page',
    activeTool === 'text' && 'editor-page--text',
    activeTool && activeTool !== 'text' && 'editor-page--shape',
    interaction && 'editor-page--interacting',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className="editor-page-wrap"
      aria-label={`Página ${displayPageNumber} de ${sourceName}`}
    >
      <div
        ref={pageRef}
        className={pageClassName}
        style={{ aspectRatio }}
        onPointerDown={handlePagePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setAreaDraft(null)
          setInteraction(null)
        }}
        onClick={handlePageClick}
      >
        <canvas ref={canvasRef} className="pdf-page-canvas" />

        {annotations
          .filter(isShapeAnnotation)
          .map((annotation) => (
            <svg
              key={annotation.id}
              className="annotation-svg"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              style={{ zIndex: annotation.layer }}
              aria-hidden="true"
            >
              <ShapeMark
                annotation={annotation}
                isSelected={selectedAnnotationId === annotation.id}
                onMoveStart={startAreaMove}
                onResizeStart={startAreaResize}
              />
            </svg>
          ))}

        {annotations.filter(isBlurAnnotation).map((annotation) => (
          <BlurMark
            key={annotation.id}
            annotation={annotation}
            isSelected={selectedAnnotationId === annotation.id}
            onMoveStart={startAreaMove}
            onResizeStart={startAreaResize}
          />
        ))}

        {annotations.filter(isSignatureAnnotation).map((annotation) => (
          <SignatureMark
            key={annotation.id}
            annotation={annotation}
            isSelected={selectedAnnotationId === annotation.id}
            onMoveStart={startAreaMove}
            onResizeStart={startAreaResize}
          />
        ))}

        {areaDraft &&
          areaDraft.type !== 'blur' &&
          areaDraft.type !== 'signature' && (
            <svg
              className="annotation-svg"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              style={{ zIndex: 10000 }}
              aria-hidden="true"
            >
              <ShapeMark annotation={areaDraft} isDraft />
            </svg>
          )}

        {areaDraft?.type === 'blur' && (
          <BlurMark annotation={areaDraft} isDraft />
        )}

        {areaDraft?.type === 'signature' && (
          <SignatureMark annotation={areaDraft} isDraft />
        )}

        {annotations.filter(isTextAnnotation).map((annotation) => (
          <button
            key={annotation.id}
            type="button"
            className={`text-annotation ${selectedAnnotationId === annotation.id ? 'text-annotation--selected' : ''}`}
            style={{
              left: `${annotation.x * 100}%`,
              top: `${annotation.y * 100}%`,
              zIndex: annotation.layer,
              ...getTextRenderStyle(annotation.format, pageWidth),
            }}
            onPointerDown={(event) => startTextMove(event, annotation)}
            onClick={(event) => {
              event.stopPropagation()
              onSelectAnnotation(annotation.id)
            }}
            onDoubleClick={(event) => {
              event.stopPropagation()
              onEditText(annotation)
            }}
            aria-label={`Texto: ${annotation.text}. Arrastra para mover y haz doble clic para editar.`}
            title="Arrastra para mover · Doble clic para editar"
          >
            {annotation.text}
          </button>
        ))}

        {textDraft?.pageId === pageId && (
          <Input
            autoFocus
            className="text-draft"
            style={{
              left: `${textDraft.x * 100}%`,
              top: `${textDraft.y * 100}%`,
              zIndex: 10001,
              ...getTextRenderStyle(textDraft.format, pageWidth),
            }}
            value={textDraft.value}
            placeholder="Escribe aquí…"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              onTextDraftChange({ ...textDraft, value: event.target.value })
            }
            onBlur={(event) => {
              const nextTarget = event.relatedTarget
              if (
                nextTarget instanceof HTMLElement &&
                nextTarget.closest('.text-format-toolbar')
              ) {
                return
              }
              onCommitText(textDraft)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                onTextDraftChange(null)
              }
            }}
            aria-label={
              textDraft.annotationId
                ? 'Editar texto del PDF'
                : 'Texto para agregar al PDF'
            }
          />
        )}
      </div>
      <Badge variant="secondary" className="editor-page-number">
        Página {displayPageNumber}
      </Badge>
      <span className="editor-page-source" title={sourceName}>
        {sourceName} · pág. original {sourcePageNumber}
      </span>
    </section>
  )
}

export function PdfPageThumbnail({
  document,
  pageNumber,
}: PdfPageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let renderTask: RenderTask | null = null

    void document.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return

      const canvas = canvasRef.current
      const baseViewport = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: 150 / baseViewport.width })
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5)

      canvas.width = Math.floor(viewport.width * outputScale)
      canvas.height = Math.floor(viewport.height * outputScale)
      canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`

      renderTask = page.render({
        canvas,
        viewport,
        transform:
          outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
      })

      void renderTask.promise.catch((renderError: unknown) => {
        if (
          renderError instanceof Error &&
          renderError.name !== 'RenderingCancelledException'
        ) {
          console.error(renderError)
        }
      })
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [document, pageNumber])

  return <canvas ref={canvasRef} className="organizer-thumbnail" />
}
