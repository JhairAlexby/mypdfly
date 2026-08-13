import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Bold,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Circle,
  FileText,
  Italic,
  Layers,
  LayersArrowDown,
  LayersArrowUp,
  LoaderCircle,
  Minus,
  MousePointer2,
  Move,
  Palette,
  RotateCcw,
  Shapes,
  Square,
  Trash2,
  Triangle,
  Type,
  Underline,
} from 'lucide-react'
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'

GlobalWorkerOptions.workerSrc = pdfWorker

type ShapeTool = 'rectangle' | 'circle' | 'triangle' | 'line'
type EditorTool = 'text' | ShapeTool | null
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end'
type LayerAction = 'front' | 'forward' | 'backward' | 'back'
type TextFontFamily = 'helvetica' | 'times' | 'georgia' | 'courier' | 'verdana'

type TextFormat = {
  fontFamily: TextFontFamily
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

type ShapeFormat = {
  color: string
  opacity: number
  strokeWidth: number
}

type Point = {
  x: number
  y: number
}

type TextAnnotation = {
  id: string
  pageNumber: number
  type: 'text'
  x: number
  y: number
  text: string
  format: TextFormat
  layer: number
}

type ShapeAnnotation = {
  id: string
  pageNumber: number
  type: ShapeTool
  start: Point
  end: Point
  format: ShapeFormat
  layer: number
}

type Annotation = TextAnnotation | ShapeAnnotation

type TextDraft = {
  annotationId: string | null
  pageNumber: number
  x: number
  y: number
  value: string
  format: TextFormat
}

type ShapeDraft = {
  type: ShapeTool
  start: Point
  end: Point
  format: ShapeFormat
}

type AnnotationInteraction =
  | {
      kind: 'shape-move'
      annotation: ShapeAnnotation
      origin: Point
    }
  | {
      kind: 'shape-resize'
      annotation: ShapeAnnotation
      handle: ResizeHandle
    }
  | {
      kind: 'text-move'
      annotation: TextAnnotation
      origin: Point
    }

type PdfPageProps = {
  pdfDocument: PDFDocumentProxy
  pageNumber: number
  activeTool: EditorTool
  textFormat: TextFormat
  shapeFormat: ShapeFormat
  annotations: Annotation[]
  selectedAnnotationId: string | null
  textDraft: TextDraft | null
  onTextDraftChange: (draft: TextDraft | null) => void
  onCommitText: (draft: TextDraft) => void
  onEditText: (annotation: TextAnnotation) => void
  onAddShape: (
    annotation: Omit<ShapeAnnotation, 'id' | 'pageNumber' | 'layer'>,
  ) => void
  onUpdateAnnotation: (annotation: Annotation) => void
  onSelectAnnotation: (id: string | null) => void
}

const toolLabels: Record<Exclude<EditorTool, null>, string> = {
  text: 'Texto',
  rectangle: 'Rectángulo',
  circle: 'Círculo',
  triangle: 'Triángulo',
  line: 'Línea',
}

const shapeOptions: Array<{
  value: ShapeTool
  label: string
  icon: typeof Square
}> = [
  { value: 'rectangle', label: 'Rectángulo', icon: Square },
  { value: 'circle', label: 'Círculo', icon: Circle },
  { value: 'triangle', label: 'Triángulo', icon: Triangle },
  { value: 'line', label: 'Línea', icon: Minus },
]

const defaultTextFormat: TextFormat = {
  fontFamily: 'helvetica',
  fontSize: 14,
  color: '#111827',
  bold: false,
  italic: false,
  underline: false,
}

const defaultShapeFormat: ShapeFormat = {
  color: '#ff5a45',
  opacity: 1,
  strokeWidth: 4,
}

const fontFamilies: Array<{
  value: TextFontFamily
  label: string
  css: string
}> = [
  { value: 'helvetica', label: 'Helvetica', css: 'Arial, Helvetica, sans-serif' },
  { value: 'times', label: 'Times New Roman', css: '"Times New Roman", Times, serif' },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  { value: 'courier', label: 'Courier', css: '"Courier New", Courier, monospace' },
  { value: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
]

const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64]

const textColors = [
  '#111827',
  '#475569',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
]

const shapeStrokeWidths = [1, 2, 3, 4, 6, 8, 12]

const getTextRenderStyle = (
  format: TextFormat,
  pageWidth: number,
): CSSProperties => ({
  color: format.color,
  fontFamily:
    fontFamilies.find((font) => font.value === format.fontFamily)?.css ??
    fontFamilies[0].css,
  fontSize: `${(format.fontSize / pageWidth) * 100}cqw`,
  fontStyle: format.italic ? 'italic' : 'normal',
  fontWeight: format.bold ? 700 : 400,
  textDecoration: format.underline ? 'underline' : 'none',
})

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

const getNextLayer = (annotations: Annotation[], pageNumber: number) =>
  Math.max(
    0,
    ...annotations
      .filter((annotation) => annotation.pageNumber === pageNumber)
      .map((annotation) => annotation.layer),
  ) + 1

const getPoint = (
  event: Pick<ReactPointerEvent<Element> | ReactMouseEvent<Element>, 'clientX' | 'clientY'>,
  element: HTMLDivElement,
): Point => {
  const bounds = element.getBoundingClientRect()

  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  }
}

const normalizeShape = (shape: ShapeDraft): ShapeDraft => {
  if (shape.type === 'line') return shape

  return {
    ...shape,
    start: {
      x: Math.min(shape.start.x, shape.end.x),
      y: Math.min(shape.start.y, shape.end.y),
    },
    end: {
      x: Math.max(shape.start.x, shape.end.x),
      y: Math.max(shape.start.y, shape.end.y),
    },
  }
}

function ShapeMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: {
  annotation: ShapeAnnotation | ShapeDraft
  isSelected?: boolean
  isDraft?: boolean
  onMoveStart?: (
    event: ReactPointerEvent<SVGElement>,
    annotation: ShapeAnnotation,
  ) => void
  onResizeStart?: (
    event: ReactPointerEvent<SVGElement>,
    annotation: ShapeAnnotation,
    handle: ResizeHandle,
  ) => void
}) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const startX = annotation.start.x * 1000
  const startY = annotation.start.y * 1000
  const endX = annotation.end.x * 1000
  const endY = annotation.end.y * 1000
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)

  const handleMoveStart = (event: ReactPointerEvent<SVGElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (savedAnnotation) onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<SVGElement>,
    handle: ResizeHandle,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    if (savedAnnotation) onResizeStart?.(event, savedAnnotation, handle)
  }

  const shapeProps = {
    fill: annotation.type === 'line' ? 'none' : annotation.format.color,
    fillOpacity: annotation.type === 'line' ? undefined : 1,
    stroke: annotation.format.color,
    strokeWidth: annotation.format.strokeWidth,
    opacity: annotation.format.opacity,
    strokeDasharray: isDraft ? '12 10' : undefined,
    vectorEffect: 'non-scaling-stroke' as const,
    onPointerDown: savedAnnotation ? handleMoveStart : undefined,
    onClick: (event: ReactMouseEvent<SVGElement>) => event.stopPropagation(),
    className: savedAnnotation ? 'annotation-shape' : undefined,
  }

  const resizeHandle = (
    handle: ResizeHandle,
    handleX: number,
    handleY: number,
  ) => (
    <circle
      key={handle}
      className="annotation-resize-handle"
      cx={handleX}
      cy={handleY}
      r="10"
      fill="white"
      stroke="#2563eb"
      strokeWidth="4"
      vectorEffect="non-scaling-stroke"
      onPointerDown={(event) => handleResizeStart(event, handle)}
      onClick={(event) => event.stopPropagation()}
    />
  )

  return (
    <g>
      {annotation.type === 'line' && (
        <>
          {savedAnnotation && (
            <line
              className="annotation-shape-hitbox"
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="transparent"
              strokeWidth="24"
              vectorEffect="non-scaling-stroke"
              onPointerDown={handleMoveStart}
              onClick={(event) => event.stopPropagation()}
            />
          )}
          <line x1={startX} y1={startY} x2={endX} y2={endY} {...shapeProps} />
        </>
      )}

      {annotation.type === 'circle' && (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...shapeProps}
        />
      )}

      {annotation.type === 'triangle' && (
        <polygon
          points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`}
          {...shapeProps}
        />
      )}

      {annotation.type === 'rectangle' && (
        <rect x={x} y={y} width={width} height={height} rx="8" {...shapeProps} />
      )}

      {isSelected && annotation.type !== 'line' && (
        <rect
          className="annotation-selection-box"
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeDasharray="8 8"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {isSelected && annotation.type === 'line' && (
        <>
          {resizeHandle('start', startX, startY)}
          {resizeHandle('end', endX, endY)}
        </>
      )}

      {isSelected && annotation.type !== 'line' && (
        <>
          {resizeHandle('nw', x, y)}
          {resizeHandle('ne', x + width, y)}
          {resizeHandle('sw', x, y + height)}
          {resizeHandle('se', x + width, y + height)}
        </>
      )}
    </g>
  )
}

function PdfPage({
  pdfDocument,
  pageNumber,
  activeTool,
  textFormat,
  shapeFormat,
  annotations,
  selectedAnnotationId,
  textDraft,
  onTextDraftChange,
  onCommitText,
  onEditText,
  onAddShape,
  onUpdateAnnotation,
  onSelectAnnotation,
}: PdfPageProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfPage, setPdfPage] = useState<PDFPageProxy | null>(null)
  const [aspectRatio, setAspectRatio] = useState(8.5 / 11)
  const [pageWidth, setPageWidth] = useState(612)
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft | null>(null)
  const [interaction, setInteraction] = useState<AnnotationInteraction | null>(null)

  useEffect(() => {
    let cancelled = false

    void pdfDocument.getPage(pageNumber).then((page) => {
      if (cancelled) return
      const viewport = page.getViewport({ scale: 1 })
      setAspectRatio(viewport.width / viewport.height)
      setPageWidth(viewport.width)
      setPdfPage(page)
    })

    return () => {
      cancelled = true
    }
  }, [pageNumber, pdfDocument])

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
    setShapeDraft({
      type: activeTool,
      start: point,
      end: point,
      format: shapeFormat,
    })
  }

  const handlePageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'text' || !pageRef.current || textDraft) return

    const point = getPoint(event, pageRef.current)
    onSelectAnnotation(null)
    onTextDraftChange({
      annotationId: null,
      pageNumber,
      x: Math.min(point.x, 0.72),
      y: Math.min(point.y, 0.94),
      value: '',
      format: textFormat,
    })
  }

  const startShapeMove = (
    event: ReactPointerEvent<SVGElement>,
    annotation: ShapeAnnotation,
  ) => {
    if (!pageRef.current) return
    onSelectAnnotation(annotation.id)
    setInteraction({
      kind: 'shape-move',
      annotation,
      origin: getPoint(event, pageRef.current),
    })
  }

  const startShapeResize = (
    _event: ReactPointerEvent<SVGElement>,
    annotation: ShapeAnnotation,
    handle: ResizeHandle,
  ) => {
    onSelectAnnotation(annotation.id)
    setInteraction({
      kind: 'shape-resize',
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

  const moveShape = (
    interactionState: Extract<AnnotationInteraction, { kind: 'shape-move' }>,
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

  const resizeShape = (
    interactionState: Extract<AnnotationInteraction, { kind: 'shape-resize' }>,
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

    if (shapeDraft) {
      setShapeDraft({ ...shapeDraft, end: point })
      return
    }

    if (!interaction) return
    event.preventDefault()

    if (interaction.kind === 'shape-move') moveShape(interaction, point)
    if (interaction.kind === 'shape-resize') resizeShape(interaction, point)
    if (interaction.kind === 'text-move') moveText(interaction, point)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pageRef.current) return

    if (shapeDraft) {
      const pointerEnd = getPoint(event, pageRef.current)
      const isTiny =
        Math.abs(pointerEnd.x - shapeDraft.start.x) < 0.015 &&
        Math.abs(pointerEnd.y - shapeDraft.start.y) < 0.015
      const end = isTiny
        ? {
            x: clamp(shapeDraft.start.x + 0.18),
            y: clamp(
              shapeDraft.start.y + (shapeDraft.type === 'line' ? 0.001 : 0.12),
            ),
          }
        : pointerEnd

      onAddShape(normalizeShape({ ...shapeDraft, end }))
      setShapeDraft(null)
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
    <section className="editor-page-wrap" aria-label={`Página ${pageNumber}`}>
      <div
        ref={pageRef}
        className={pageClassName}
        style={{ aspectRatio }}
        onPointerDown={handlePagePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          setShapeDraft(null)
          setInteraction(null)
        }}
        onClick={handlePageClick}
      >
        <canvas ref={canvasRef} className="pdf-page-canvas" />

        {annotations
          .filter((annotation): annotation is ShapeAnnotation => annotation.type !== 'text')
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
                onMoveStart={startShapeMove}
                onResizeStart={startShapeResize}
              />
            </svg>
          ))}

        {shapeDraft && (
          <svg
            className="annotation-svg"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{ zIndex: 10000 }}
            aria-hidden="true"
          >
            <ShapeMark annotation={shapeDraft} isDraft />
          </svg>
        )}

        {annotations
          .filter((annotation): annotation is TextAnnotation => annotation.type === 'text')
          .map((annotation) => (
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

        {textDraft?.pageNumber === pageNumber && (
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
        Página {pageNumber}
      </Badge>
    </section>
  )
}

export function PdfEditor({ file }: { file: File }) {
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)
  const [loadError, setLoadError] = useState('')
  const [activeTool, setActiveTool] = useState<EditorTool>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [currentTextFormat, setCurrentTextFormat] =
    useState<TextFormat>(defaultTextFormat)
  const [currentShapeFormat, setCurrentShapeFormat] =
    useState<ShapeFormat>(defaultShapeFormat)

  useEffect(() => {
    let cancelled = false
    let loadingTask: PDFDocumentLoadingTask | null = null

    const loadPdf = async () => {
      const buffer = await file.arrayBuffer()
      loadingTask = getDocument({ data: new Uint8Array(buffer) })
      const document = await loadingTask.promise

      if (!cancelled) setPdfDocument(document)
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
  }, [file])

  const selectedAnnotation = annotations.find(
    (annotation) => annotation.id === selectedAnnotationId,
  )
  const selectedText =
    selectedAnnotation?.type === 'text' ? selectedAnnotation : null
  const selectedShape =
    selectedAnnotation && selectedAnnotation.type !== 'text'
      ? selectedAnnotation
      : null
  const activeTextFormat =
    textDraft?.format ?? selectedText?.format ?? currentTextFormat
  const activeShapeFormat = selectedShape?.format ?? currentShapeFormat
  const showTextFormatter =
    activeTool === 'text' || Boolean(textDraft) || Boolean(selectedText)
  const shapeToolActive = activeTool !== null && activeTool !== 'text'
  const showShapeFormatter = shapeToolActive || Boolean(selectedShape)

  const selectAnnotation = (id: string | null) => {
    setSelectedAnnotationId(id)
    if (!id) return

    const annotation = annotations.find((item) => item.id === id)
    if (annotation?.type === 'text') {
      setCurrentTextFormat(annotation.format)
    } else if (annotation) {
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
            ? {
                ...annotation,
                format: { ...annotation.format, ...patch },
              }
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
          annotation.id === selectedShape.id && annotation.type !== 'text'
            ? {
                ...annotation,
                format: { ...annotation.format, ...patch },
              }
            : annotation,
        ),
      )
    }
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
          pageNumber: draft.pageNumber,
          type: 'text',
          x: draft.x,
          y: draft.y,
          text,
          format: draft.format,
          layer: getNextLayer(current, draft.pageNumber),
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
      pageNumber: annotation.pageNumber,
      x: annotation.x,
      y: annotation.y,
      value: annotation.text,
      format: annotation.format,
    })
  }

  const addShape = (
    pageNumber: number,
    shape: Omit<ShapeAnnotation, 'id' | 'pageNumber' | 'layer'>,
  ) => {
    const annotationId = crypto.randomUUID()
    setAnnotations((current) => [
      ...current,
      {
        ...shape,
        id: annotationId,
        pageNumber,
        layer: getNextLayer(current, pageNumber),
      },
    ])
    setSelectedAnnotationId(annotationId)
    setCurrentShapeFormat(shape.format)
    setActiveTool(null)
  }

  const updateAnnotation = (updatedAnnotation: Annotation) => {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === updatedAnnotation.id ? updatedAnnotation : annotation,
      ),
    )
  }

  const changeSelectedShapeLayer = (action: LayerAction) => {
    if (!selectedShape) return

    setAnnotations((current) => {
      const pageAnnotations = current
        .filter(
          (annotation) => annotation.pageNumber === selectedShape.pageNumber,
        )
        .sort((first, second) => first.layer - second.layer)
      const currentIndex = pageAnnotations.findIndex(
        (annotation) => annotation.id === selectedShape.id,
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
        annotation.pageNumber === selectedShape.pageNumber
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

  return (
    <div
      className={`pdf-editor ${showTextFormatter || showShapeFormatter ? 'pdf-editor--context-format' : ''}`}
    >
      <div className="editor-toolbar" aria-label="Herramientas de edición">
        <div className="flex min-w-max items-center gap-1.5">
          <Button
            variant={activeTool === 'text' ? 'secondary' : 'ghost'}
            size="sm"
            className={activeTool === 'text' ? 'editor-tool-active' : ''}
            onClick={() => {
              setActiveTool((current) => (current === 'text' ? null : 'text'))
              setSelectedAnnotationId(null)
              setTextDraft(null)
            }}
            aria-pressed={activeTool === 'text'}
          >
            <Type data-icon="inline-start" />
            Texto
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={shapeToolActive ? 'secondary' : 'ghost'}
                size="sm"
                className={shapeToolActive ? 'editor-tool-active' : ''}
                aria-pressed={shapeToolActive}
              >
                <Shapes data-icon="inline-start" />
                Formas
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 p-1.5">
              <DropdownMenuLabel>Selecciona una forma</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {shapeOptions.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem
                  key={value}
                  className="h-9 gap-2 px-2"
                  onSelect={() => {
                    setActiveTool(value)
                    setSelectedAnnotationId(null)
                    setTextDraft(null)
                  }}
                >
                  <Icon />
                  {label}
                  {activeTool === value && (
                    <span className="ml-auto size-1.5 rounded-full bg-[#ff5a45]" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="mx-1 h-6" />

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={removeSelectedAnnotation}
            disabled={!selectedAnnotationId}
            aria-label="Eliminar elemento seleccionado"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>

        <div className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
          {activeTool ? (
            <>
              <MousePointer2 className="size-3.5 text-[#ff5a45]" aria-hidden="true" />
              {activeTool === 'text'
                ? 'Haz clic en la página y escribe'
                : 'Haz clic y arrastra para dibujar'}
              <Badge variant="secondary" className="ml-1 rounded-full px-2 text-[11px]">
                {toolLabels[activeTool]}
              </Badge>
            </>
          ) : selectedAnnotation ? (
            <>
              <Move className="size-3.5 text-blue-600" aria-hidden="true" />
              {selectedAnnotation.type === 'text'
                ? 'Arrastra para mover · Doble clic para editar'
                : 'Arrastra para mover · Usa los puntos azules para redimensionar'}
            </>
          ) : (
            'Selecciona Texto o Formas para comenzar'
          )}
        </div>
      </div>

      {showTextFormatter && (
        <div
          className="text-format-toolbar"
          role="toolbar"
          aria-label="Formato de texto"
        >
          <span className="text-format-label">Formato</span>

          <Select
            value={activeTextFormat.fontFamily}
            onValueChange={(value) =>
              applyTextFormat({ fontFamily: value as TextFontFamily })
            }
          >
            <SelectTrigger
              size="sm"
              className="text-font-select"
              aria-label="Familia tipográfica"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {fontFamilies.map((font) => (
                <SelectItem
                  key={font.value}
                  value={font.value}
                  style={{ fontFamily: font.css }}
                >
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(activeTextFormat.fontSize)}
            onValueChange={(value) =>
              applyTextFormat({ fontSize: Number(value) })
            }
          >
            <SelectTrigger
              size="sm"
              className="text-size-select"
              aria-label="Tamaño de letra"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className="min-w-24">
              {fontSizes.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} pt
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-color-trigger"
                aria-label="Cambiar color del texto"
              >
                <Palette data-icon="inline-start" />
                <span
                  className="text-color-current"
                  style={{ backgroundColor: activeTextFormat.color }}
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Color del texto</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Selecciona un color o crea uno personalizado.
                </p>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {textColors.map((color) => (
                  <Button
                    key={color}
                    variant="outline"
                    size="icon-sm"
                    className={`text-color-swatch ${activeTextFormat.color === color ? 'text-color-swatch--active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyTextFormat({ color })}
                    aria-label={`Usar color ${color}`}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                Personalizado
                <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-slate-500">
                  {activeTextFormat.color.toUpperCase()}
                  <Input
                    type="color"
                    className="h-8 w-10 cursor-pointer p-1"
                    value={activeTextFormat.color}
                    onChange={(event) =>
                      applyTextFormat({ color: event.target.value })
                    }
                    aria-label="Elegir color personalizado"
                  />
                </span>
              </label>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <div className="flex items-center gap-1" aria-label="Estilo de letra">
            <Button
              variant={activeTextFormat.bold ? 'secondary' : 'outline'}
              size="icon-sm"
              className={activeTextFormat.bold ? 'text-format-active' : ''}
              onClick={() => applyTextFormat({ bold: !activeTextFormat.bold })}
              aria-label="Negrita"
              aria-pressed={activeTextFormat.bold}
            >
              <Bold aria-hidden="true" />
            </Button>
            <Button
              variant={activeTextFormat.italic ? 'secondary' : 'outline'}
              size="icon-sm"
              className={activeTextFormat.italic ? 'text-format-active' : ''}
              onClick={() => applyTextFormat({ italic: !activeTextFormat.italic })}
              aria-label="Cursiva"
              aria-pressed={activeTextFormat.italic}
            >
              <Italic aria-hidden="true" />
            </Button>
            <Button
              variant={activeTextFormat.underline ? 'secondary' : 'outline'}
              size="icon-sm"
              className={activeTextFormat.underline ? 'text-format-active' : ''}
              onClick={() =>
                applyTextFormat({ underline: !activeTextFormat.underline })
              }
              aria-label="Subrayado"
              aria-pressed={activeTextFormat.underline}
            >
              <Underline aria-hidden="true" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => applyTextFormat(defaultTextFormat)}
            aria-label="Restablecer formato"
            title="Restablecer formato"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      )}

      {showShapeFormatter && (
        <div
          className="shape-format-toolbar"
          role="toolbar"
          aria-label="Formato de formas"
        >
          <span className="shape-format-label">Forma</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shape-color-trigger"
                aria-label="Cambiar color de la forma"
              >
                <Palette data-icon="inline-start" />
                Color
                <span
                  className="shape-color-current"
                  style={{ backgroundColor: activeShapeFormat.color }}
                  aria-hidden="true"
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">Color de la forma</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Se aplicará al borde y al relleno.
                </p>
              </div>
              <div className="grid grid-cols-8 gap-1.5">
                {textColors.map((color) => (
                  <Button
                    key={color}
                    variant="outline"
                    size="icon-sm"
                    className={`shape-color-swatch ${activeShapeFormat.color === color ? 'shape-color-swatch--active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => applyShapeFormat({ color })}
                    aria-label={`Usar color ${color} en la forma`}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                Personalizado
                <span className="flex items-center gap-2 font-mono text-[11px] font-normal text-slate-500">
                  {activeShapeFormat.color.toUpperCase()}
                  <Input
                    type="color"
                    className="h-8 w-10 cursor-pointer p-1"
                    value={activeShapeFormat.color}
                    onChange={(event) =>
                      applyShapeFormat({ color: event.target.value })
                    }
                    aria-label="Elegir color personalizado para la forma"
                  />
                </span>
              </label>
            </PopoverContent>
          </Popover>

          <div className="shape-opacity-control">
            <span className="shape-control-label">Opacidad</span>
            <Slider
              className="w-28"
              min={10}
              max={100}
              step={5}
              value={[Math.round(activeShapeFormat.opacity * 100)]}
              onValueChange={(value) =>
                applyShapeFormat({ opacity: (value[0] ?? 100) / 100 })
              }
              aria-label="Opacidad de la forma"
            />
            <span className="shape-control-value">
              {Math.round(activeShapeFormat.opacity * 100)}%
            </span>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <Select
            value={String(activeShapeFormat.strokeWidth)}
            onValueChange={(value) =>
              applyShapeFormat({ strokeWidth: Number(value) })
            }
          >
            <SelectTrigger
              size="sm"
              className="shape-width-select"
              aria-label="Ancho del borde"
            >
              <Minus className="size-3.5" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start" className="min-w-36">
              {shapeStrokeWidths.map((width) => (
                <SelectItem key={width} value={String(width)}>
                  {width} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shape-position-trigger"
                disabled={!selectedShape}
                aria-label="Cambiar posición de la forma"
              >
                <Layers data-icon="inline-start" />
                Posición
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52 p-1.5">
              <DropdownMenuLabel>Orden de la capa</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedShapeLayer('front')}
              >
                <ChevronsUp />
                Traer al frente
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedShapeLayer('forward')}
              >
                <LayersArrowUp />
                Subir un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedShapeLayer('backward')}
              >
                <LayersArrowDown />
                Bajar un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedShapeLayer('back')}
              >
                <ChevronsDown />
                Enviar al fondo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => applyShapeFormat(defaultShapeFormat)}
            aria-label="Restablecer formato de la forma"
            title="Restablecer formato"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="editor-canvas-area">
        {!pdfDocument && !loadError && (
          <div className="editor-state">
            <LoaderCircle className="size-7 animate-spin text-[#ff5a45]" aria-hidden="true" />
            <p>Preparando las páginas…</p>
          </div>
        )}

        {loadError && (
          <div className="editor-state text-center">
            <FileText className="size-9 text-slate-400" aria-hidden="true" />
            <p className="font-medium text-slate-700">{loadError}</p>
          </div>
        )}

        {pdfDocument && (
          <div className="pdf-pages">
            {Array.from({ length: pdfDocument.numPages }, (_, index) => {
              const pageNumber = index + 1
              return (
                <PdfPage
                  key={pageNumber}
                  pdfDocument={pdfDocument}
                  pageNumber={pageNumber}
                  activeTool={activeTool}
                  textFormat={activeTextFormat}
                  shapeFormat={activeShapeFormat}
                  annotations={annotations.filter(
                    (annotation) => annotation.pageNumber === pageNumber,
                  )}
                  selectedAnnotationId={selectedAnnotationId}
                  textDraft={textDraft}
                  onTextDraftChange={setTextDraft}
                  onCommitText={commitText}
                  onEditText={editText}
                  onAddShape={(shape) => addShape(pageNumber, shape)}
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
          {pdfDocument
            ? `${pdfDocument.numPages} ${pdfDocument.numPages === 1 ? 'página' : 'páginas'}`
            : 'Cargando PDF'}
        </span>
        <span>
          {annotations.length}{' '}
          {annotations.length === 1 ? 'elemento agregado' : 'elementos agregados'}
        </span>
      </div>
    </div>
  )
}
