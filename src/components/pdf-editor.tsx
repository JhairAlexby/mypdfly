import { useEffect, useId, useRef, useState } from 'react'
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Blend,
  Bold,
  Check,
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Eraser,
  Feather,
  FileText,
  Files,
  GripVertical,
  Italic,
  Layers,
  LayersArrowDown,
  LayersArrowUp,
  LoaderCircle,
  Minus,
  MousePointer2,
  Move,
  Palette,
  PenLine,
  RotateCcw,
  Shapes,
  Square,
  Signature as SignatureIcon,
  Trash2,
  Triangle,
  Type,
  Underline,
  UploadCloud,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
type EditorTool = 'text' | 'blur' | 'signature' | ShapeTool | null
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

type BlurFormat = {
  intensity: number
}

type SignatureEffect = 'clean' | 'natural'

type SignatureFormat = {
  color: string
  strokeWidth: number
  effect: SignatureEffect
}

type Point = {
  x: number
  y: number
}

type TextAnnotation = {
  id: string
  pageId: string
  type: 'text'
  x: number
  y: number
  text: string
  format: TextFormat
  layer: number
}

type ShapeAnnotation = {
  id: string
  pageId: string
  type: ShapeTool
  start: Point
  end: Point
  format: ShapeFormat
  layer: number
}

type BlurAnnotation = {
  id: string
  pageId: string
  type: 'blur'
  start: Point
  end: Point
  format: BlurFormat
  layer: number
}

type SignaturePoint = Point & {
  pressure: number
}

type SignatureStroke = SignaturePoint[]

type SignatureAnnotation = {
  id: string
  pageId: string
  type: 'signature'
  start: Point
  end: Point
  strokes: SignatureStroke[]
  format: SignatureFormat
  layer: number
}

type SignatureTemplate = Pick<SignatureAnnotation, 'strokes' | 'format'>

type PdfSource = {
  id: string
  file: File
  document: PDFDocumentProxy
}

type PdfPageReference = {
  id: string
  sourceId: string
  sourcePageNumber: number
}

type AreaAnnotation = ShapeAnnotation | BlurAnnotation | SignatureAnnotation
type Annotation = TextAnnotation | AreaAnnotation

type TextDraft = {
  annotationId: string | null
  pageId: string
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

type BlurDraft = {
  type: 'blur'
  start: Point
  end: Point
  format: BlurFormat
}

type SignatureDraft = {
  type: 'signature'
  start: Point
  end: Point
  strokes: SignatureStroke[]
  format: SignatureFormat
}

type AreaDraft = ShapeDraft | BlurDraft | SignatureDraft

type AnnotationInteraction =
  | {
      kind: 'area-move'
      annotation: AreaAnnotation
      origin: Point
    }
  | {
      kind: 'area-resize'
      annotation: AreaAnnotation
      handle: ResizeHandle
    }
  | {
      kind: 'text-move'
      annotation: TextAnnotation
      origin: Point
    }

type PdfPageProps = {
  pdfDocument: PDFDocumentProxy
  sourcePageNumber: number
  pageId: string
  displayPageNumber: number
  sourceName: string
  activeTool: EditorTool
  textFormat: TextFormat
  shapeFormat: ShapeFormat
  blurFormat: BlurFormat
  signatureTemplate: SignatureTemplate | null
  annotations: Annotation[]
  selectedAnnotationId: string | null
  textDraft: TextDraft | null
  onTextDraftChange: (draft: TextDraft | null) => void
  onCommitText: (draft: TextDraft) => void
  onEditText: (annotation: TextAnnotation) => void
  onAddShape: (
    annotation: Omit<ShapeAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => void
  onAddBlur: (
    annotation: Omit<BlurAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => void
  onAddSignature: (
    annotation: Omit<SignatureAnnotation, 'id' | 'pageId' | 'layer'>,
  ) => void
  onUpdateAnnotation: (annotation: Annotation) => void
  onSelectAnnotation: (id: string | null) => void
}

const toolLabels: Record<Exclude<EditorTool, null>, string> = {
  text: 'Texto',
  blur: 'Difuminar',
  signature: 'Firma',
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

const defaultBlurFormat: BlurFormat = {
  intensity: 12,
}

const defaultSignatureFormat: SignatureFormat = {
  color: '#111827',
  strokeWidth: 6,
  effect: 'natural',
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
const pdfSourceColors = ['#ff5a45', '#2563eb', '#16a34a', '#7c3aed', '#ca8a04']

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

const getNextLayer = (annotations: Annotation[], pageId: string) =>
  Math.max(
    0,
    ...annotations
      .filter((annotation) => annotation.pageId === pageId)
      .map((annotation) => annotation.layer),
  ) + 1

const isTextAnnotation = (
  annotation: Annotation,
): annotation is TextAnnotation => annotation.type === 'text'

const isShapeAnnotation = (
  annotation: Annotation,
): annotation is ShapeAnnotation =>
  annotation.type === 'rectangle' ||
  annotation.type === 'circle' ||
  annotation.type === 'triangle' ||
  annotation.type === 'line'

const isBlurAnnotation = (
  annotation: Annotation,
): annotation is BlurAnnotation => annotation.type === 'blur'

const isSignatureAnnotation = (
  annotation: Annotation,
): annotation is SignatureAnnotation => annotation.type === 'signature'

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

const normalizeArea = (area: AreaDraft): AreaDraft => {
  if (area.type === 'line') return area

  return {
    ...area,
    start: {
      x: Math.min(area.start.x, area.end.x),
      y: Math.min(area.start.y, area.end.y),
    },
    end: {
      x: Math.max(area.start.x, area.end.x),
      y: Math.max(area.start.y, area.end.y),
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

function BlurMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: {
  annotation: BlurAnnotation | BlurDraft
  isSelected?: boolean
  isDraft?: boolean
  onMoveStart?: (
    event: ReactPointerEvent<HTMLDivElement>,
    annotation: BlurAnnotation,
  ) => void
  onResizeStart?: (
    event: ReactPointerEvent<HTMLSpanElement>,
    annotation: BlurAnnotation,
    handle: ResizeHandle,
  ) => void
}) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const x = Math.min(annotation.start.x, annotation.end.x)
  const y = Math.min(annotation.start.y, annotation.end.y)
  const width = Math.abs(annotation.end.x - annotation.start.x)
  const height = Math.abs(annotation.end.y - annotation.start.y)

  const handleMoveStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<HTMLSpanElement>,
    handle: ResizeHandle,
  ) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeStart?.(event, savedAnnotation, handle)
  }

  return (
    <div
      className={[
        'blur-annotation',
        isSelected && 'blur-annotation--selected',
        isDraft && 'blur-annotation--draft',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        zIndex: savedAnnotation?.layer ?? 10000,
        backdropFilter: `blur(${annotation.format.intensity}px)`,
        WebkitBackdropFilter: `blur(${annotation.format.intensity}px)`,
      }}
      onPointerDown={savedAnnotation ? handleMoveStart : undefined}
      onClick={(event) => event.stopPropagation()}
      title={savedAnnotation ? 'Arrastra para mover el área difuminada' : undefined}
    >
      {isDraft && <span className="blur-draft-label">Difuminar</span>}
      {isSelected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
          <span
            key={handle}
            className={`blur-resize-handle blur-resize-handle--${handle}`}
            onPointerDown={(event) => handleResizeStart(event, handle)}
            onClick={(event) => event.stopPropagation()}
            aria-hidden="true"
          />
        ))}
    </div>
  )
}

const getSignaturePath = (stroke: SignatureStroke) => {
  if (stroke.length < 2) return ''

  const toCoordinates = (point: SignaturePoint) => ({
    x: point.x * 1000,
    y: point.y * 300,
  })
  const first = toCoordinates(stroke[0])
  let path = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`

  for (let index = 1; index < stroke.length - 1; index += 1) {
    const point = toCoordinates(stroke[index])
    const nextPoint = toCoordinates(stroke[index + 1])
    const middleX = (point.x + nextPoint.x) / 2
    const middleY = (point.y + nextPoint.y) / 2
    path += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${middleX.toFixed(2)} ${middleY.toFixed(2)}`
  }

  const last = toCoordinates(stroke[stroke.length - 1])
  return `${path} L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`
}

const getNaturalInkVariation = (strokeIndex: number, segmentIndex: number) => {
  const value =
    Math.sin((strokeIndex + 1) * 12.9898 + (segmentIndex + 1) * 78.233) *
    43758.5453
  return value - Math.floor(value)
}

function SignatureDrawing({
  strokes,
  format,
}: {
  strokes: SignatureStroke[]
  format: SignatureFormat
}) {
  const inkFilterId = `signature-ink-${useId().replace(/:/g, '')}`
  const hasNaturalEffect = format.effect !== 'clean'

  return (
    <>
      {hasNaturalEffect && (
        <defs>
          <filter
            id={inkFilterId}
            x="-5%"
            y="-15%"
            width="110%"
            height="130%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.045"
              numOctaves={2}
              seed={17}
              result="inkNoise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="inkNoise"
              scale={Math.max(0.6, format.strokeWidth * 0.16)}
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      )}
      <g filter={hasNaturalEffect ? `url(#${inkFilterId})` : undefined}>
        {strokes.map((stroke, strokeIndex) => {
        const averagePressure =
          stroke.reduce((total, point) => total + point.pressure, 0) /
          Math.max(stroke.length, 1)
        const strokeWidth = format.strokeWidth * (0.85 + averagePressure * 0.3)

        if (stroke.length === 1) {
          const pointWidth = hasNaturalEffect
            ? format.strokeWidth *
              (0.72 + stroke[0].pressure * 0.56) *
              (0.94 + getNaturalInkVariation(strokeIndex, 0) * 0.12)
            : strokeWidth

          return (
            <circle
              key={strokeIndex}
              cx={stroke[0].x * 1000}
              cy={stroke[0].y * 300}
              r={pointWidth / 2}
              fill={format.color}
            />
          )
        }

        if (hasNaturalEffect) {
          const segmentCount = stroke.length - 1

          return (
            <g key={strokeIndex}>
              {stroke.slice(1).map((point, segmentIndex) => {
                const previousPoint = stroke[segmentIndex]
                const pressure = (previousPoint.pressure + point.pressure) / 2
                const edgeDistance = Math.min(
                  segmentIndex + 1,
                  segmentCount - segmentIndex,
                )
                const taper = Math.min(1, 0.68 + edgeDistance * 0.14)
                const variation = getNaturalInkVariation(
                  strokeIndex,
                  segmentIndex,
                )
                const opacityVariation = getNaturalInkVariation(
                  strokeIndex + 31,
                  segmentIndex,
                )
                const naturalStrokeWidth =
                  format.strokeWidth *
                  (0.72 + pressure * 0.56) *
                  (0.94 + variation * 0.12) *
                  taper

                return (
                  <path
                    key={segmentIndex}
                    d={`M ${(previousPoint.x * 1000).toFixed(2)} ${(previousPoint.y * 300).toFixed(2)} L ${(point.x * 1000).toFixed(2)} ${(point.y * 300).toFixed(2)}`}
                    fill="none"
                    stroke={format.color}
                    strokeWidth={naturalStrokeWidth}
                    strokeOpacity={0.9 + opacityVariation * 0.1}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )
              })}
            </g>
          )
        }

        return (
          <path
            key={strokeIndex}
            d={getSignaturePath(stroke)}
            fill="none"
            stroke={format.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
        })}
      </g>
    </>
  )
}

function SignaturePad({
  initialFormat,
  onCancel,
  onUse,
}: {
  initialFormat: SignatureFormat
  onCancel: () => void
  onUse: (strokes: SignatureStroke[], format: SignatureFormat) => void
}) {
  const padRef = useRef<SVGSVGElement>(null)
  const strokesRef = useRef<SignatureStroke[]>([])
  const activePointerRef = useRef<number | null>(null)
  const activeStrokeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [strokes, setStrokes] = useState<SignatureStroke[]>([])
  const [format, setFormat] = useState(initialFormat)

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  const scheduleRender = () => {
    if (animationFrameRef.current !== null) return
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null
      setStrokes(strokesRef.current.map((stroke) => [...stroke]))
    })
  }

  const toSignaturePoint = (event: PointerEvent): SignaturePoint | null => {
    if (!padRef.current) return null
    const bounds = padRef.current.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return null

    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    }
  }

  const appendSignaturePoint = (point: SignaturePoint) => {
    const strokeIndex = activeStrokeRef.current
    if (strokeIndex === null) return false
    const stroke = strokesRef.current[strokeIndex]
    if (!stroke) return false

    const previousPoint = stroke[stroke.length - 1]
    if (
      previousPoint &&
      Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) < 0.0015
    ) {
      return false
    }

    stroke.push(point)
    return true
  }

  const appendPoints = (events: PointerEvent[]) => {
    let didAppend = false
    events.forEach((event) => {
      const point = toSignaturePoint(event)
      if (!point) return
      didAppend = appendSignaturePoint(point) || didAppend
    })
    if (didAppend) scheduleRender()
  }

  const beginStroke = (point: SignaturePoint) => {
    activeStrokeRef.current = strokesRef.current.length
    strokesRef.current = [...strokesRef.current, [point]]
    scheduleRender()
  }

  const startDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !padRef.current) return
    event.preventDefault()
    const point = toSignaturePoint(event.nativeEvent)
    if (!point) return

    event.currentTarget.setPointerCapture(event.pointerId)
    activePointerRef.current = event.pointerId
    beginStroke(point)
  }

  const continueDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    event.preventDefault()
    const coalescedEvents = event.nativeEvent.getCoalescedEvents?.()
    appendPoints(coalescedEvents?.length ? coalescedEvents : [event.nativeEvent])
  }

  const finishDrawing = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    event.preventDefault()
    appendPoints([event.nativeEvent])
    activePointerRef.current = null
    activeStrokeRef.current = null
  }

  const clearSignature = () => {
    activePointerRef.current = null
    activeStrokeRef.current = null
    strokesRef.current = []
    setStrokes([])
  }

  const hasSignature = strokes.some((stroke) => stroke.length > 1)

  return (
    <>
      <div
        className="signature-pad-tools"
        role="toolbar"
        aria-label="Formato de la firma"
      >
        <div className="signature-pad-control">
          <span className="signature-pad-tool-label">
            <PenLine aria-hidden="true" />
            Tinta
          </span>
          {['#111827', '#1d4ed8'].map((color) => (
            <Button
              key={color}
              type="button"
              variant="outline"
              size="icon-sm"
              className={`signature-ink-swatch ${format.color === color ? 'signature-ink-swatch--active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => setFormat((current) => ({ ...current, color }))}
              aria-label={color === '#111827' ? 'Tinta negra' : 'Tinta azul'}
            />
          ))}
        </div>

        <div className="signature-pad-control signature-width-control">
          <span className="signature-pad-tool-label">
            <Minus aria-hidden="true" />
            Grosor
          </span>
          <Slider
            className="signature-width-slider"
            min={2}
            max={14}
            step={1}
            value={[format.strokeWidth]}
            onValueChange={(value) =>
              setFormat((current) => ({
                ...current,
                strokeWidth: value[0] ?? current.strokeWidth,
              }))
            }
            aria-label="Grosor de la firma"
          />
          <span className="signature-control-value">
            {format.strokeWidth} px
          </span>
        </div>

        <Button
          type="button"
          variant={format.effect === 'natural' ? 'secondary' : 'outline'}
          size="sm"
          className={
            format.effect === 'natural' ? 'signature-natural-active' : ''
          }
          onClick={() =>
            setFormat((current) => ({
              ...current,
              effect: current.effect === 'natural' ? 'clean' : 'natural',
            }))
          }
          aria-pressed={format.effect === 'natural'}
          title="Añade variaciones sutiles de presión y tinta"
        >
          <Feather data-icon="inline-start" />
          Tinta natural
        </Button>
      </div>

      <div className="signature-pad-wrap">
        <svg
          ref={padRef}
          className="signature-pad"
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          onPointerDown={startDrawing}
          onPointerMove={continueDrawing}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          aria-label="Lienzo para dibujar la firma"
          role="img"
        >
          <SignatureDrawing strokes={strokes} format={format} />
        </svg>
        {!hasSignature && (
          <div className="signature-pad-placeholder" aria-hidden="true">
            <SignatureIcon />
            <span>Firma aquí</span>
          </div>
        )}
        <span className="signature-pad-baseline" aria-hidden="true" />
      </div>

      <p className="signature-pad-hint">
        Mantén presionado mientras firmas. Suelta y vuelve a presionar para
        agregar otra parte.
      </p>

      <DialogFooter className="items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={clearSignature}
          disabled={!strokes.length}
        >
          <Eraser data-icon="inline-start" />
          Limpiar
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() =>
              onUse(
                strokesRef.current.map((stroke) => [...stroke]),
                format,
              )
            }
            disabled={!hasSignature}
          >
            <Check data-icon="inline-start" />
            Usar firma
          </Button>
        </div>
      </DialogFooter>
    </>
  )
}

function SignatureMark({
  annotation,
  isSelected = false,
  isDraft = false,
  onMoveStart,
  onResizeStart,
}: {
  annotation: SignatureAnnotation | SignatureDraft
  isSelected?: boolean
  isDraft?: boolean
  onMoveStart?: (
    event: ReactPointerEvent<HTMLDivElement>,
    annotation: SignatureAnnotation,
  ) => void
  onResizeStart?: (
    event: ReactPointerEvent<HTMLSpanElement>,
    annotation: SignatureAnnotation,
    handle: ResizeHandle,
  ) => void
}) {
  const savedAnnotation = 'id' in annotation ? annotation : null
  const x = Math.min(annotation.start.x, annotation.end.x)
  const y = Math.min(annotation.start.y, annotation.end.y)
  const width = Math.abs(annotation.end.x - annotation.start.x)
  const height = Math.abs(annotation.end.y - annotation.start.y)

  const handleMoveStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onMoveStart?.(event, savedAnnotation)
  }

  const handleResizeStart = (
    event: ReactPointerEvent<HTMLSpanElement>,
    handle: ResizeHandle,
  ) => {
    if (!savedAnnotation) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onResizeStart?.(event, savedAnnotation, handle)
  }

  return (
    <div
      className={[
        'signature-annotation',
        isSelected && 'signature-annotation--selected',
        isDraft && 'signature-annotation--draft',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        zIndex: savedAnnotation?.layer ?? 10000,
      }}
      onPointerDown={savedAnnotation ? handleMoveStart : undefined}
      onClick={(event) => event.stopPropagation()}
      title={savedAnnotation ? 'Arrastra para mover la firma' : undefined}
    >
      <svg
        className="signature-annotation-drawing"
        viewBox="0 0 1000 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <SignatureDrawing
          strokes={annotation.strokes}
          format={annotation.format}
        />
      </svg>
      {isSelected &&
        (['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
          <span
            key={handle}
            className={`signature-resize-handle signature-resize-handle--${handle}`}
            onPointerDown={(event) => handleResizeStart(event, handle)}
            onClick={(event) => event.stopPropagation()}
            aria-hidden="true"
          />
        ))}
    </div>
  )
}

function PdfPage({
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
  const [interaction, setInteraction] = useState<AnnotationInteraction | null>(null)

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

        {annotations
          .filter(isTextAnnotation)
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

function PdfPageThumbnail({
  document,
  pageNumber,
}: {
  document: PDFDocumentProxy
  pageNumber: number
}) {
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

export function PdfEditor({
  initialFile,
  onSummaryChange,
}: {
  initialFile: File
  onSummaryChange?: (summary: {
    fileCount: number
    pageCount: number
    totalSize: number
  }) => void
}) {
  const addPdfInputRef = useRef<HTMLInputElement>(null)
  const additionalLoadingTasksRef = useRef<Set<PDFDocumentLoadingTask>>(new Set())
  const isMountedRef = useRef(true)
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([])
  const [orderedPages, setOrderedPages] = useState<PdfPageReference[]>([])
  const [loadError, setLoadError] = useState('')
  const [organizerError, setOrganizerError] = useState('')
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [isAddingPdfs, setIsAddingPdfs] = useState(false)
  const [draggedPageId, setDraggedPageId] = useState<string | null>(null)
  const [dropTargetPageId, setDropTargetPageId] = useState<string | null>(null)
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
  const selectedOrganizerPage = orderedPages.find(
    (page) => page.id === selectedPageId,
  )
  const selectedOrganizerIndex = selectedOrganizerPage
    ? orderedPages.findIndex((page) => page.id === selectedOrganizerPage.id)
    : -1

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

    const rejectedNames = [...invalidFiles.map((file) => file.name), ...failedNames]
    if (rejectedNames.length) {
      setOrganizerError(
        `No se ${rejectedNames.length === 1 ? 'pudo abrir' : 'pudieron abrir'}: ${rejectedNames.join(', ')}. Los demás documentos se conservaron.`,
      )
    }

    setIsAddingPdfs(false)
  }

  const handleAdditionalPdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addPdfFiles(files)
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

  const moveSelectedPage = (position: number) => {
    if (!selectedPageId) return
    movePage(selectedPageId, position)
  }

  const handlePageDrop = (
    event: ReactDragEvent<HTMLElement>,
    targetPageId: string,
  ) => {
    event.preventDefault()
    const pageId = draggedPageId ?? event.dataTransfer.getData('text/plain')
    const targetIndex = orderedPages.findIndex(
      (page) => page.id === targetPageId,
    )

    if (pageId && targetIndex >= 0 && pageId !== targetPageId) {
      movePage(pageId, targetIndex + 1)
    }

    setDraggedPageId(null)
    setDropTargetPageId(null)
  }

  const selectedAnnotation = annotations.find(
    (annotation) => annotation.id === selectedAnnotationId,
  )
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
          annotation.id === selectedShape.id && isShapeAnnotation(annotation)
            ? {
                ...annotation,
                format: { ...annotation.format, ...patch },
              }
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
            ? {
                ...annotation,
                format: { ...annotation.format, ...patch },
              }
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
          ? {
              ...annotation,
              format: { ...annotation.format, ...patch },
            }
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
        .filter(
          (annotation) => annotation.pageId === selectedArea.pageId,
        )
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

  return (
    <div
      className={`pdf-editor ${showTextFormatter || showShapeFormatter || showBlurFormatter || showSignatureFormatter ? 'pdf-editor--context-format' : ''}`}
    >
      <Dialog open={organizerOpen} onOpenChange={handleOrganizerOpenChange}>
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
                {pdfSources.length}{' '}
                {pdfSources.length === 1 ? 'archivo' : 'archivos'}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {orderedPages.length}{' '}
                {orderedPages.length === 1 ? 'página' : 'páginas'}
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

          {organizerError && (
            <div className="page-organizer-error" role="alert">
              <FileText aria-hidden="true" />
              <span>{organizerError}</span>
            </div>
          )}

          <div className="page-organizer-scroll">
            <div className="page-organizer-grid">
              {orderedPages.map((page, index) => {
                const source = sourcesById.get(page.sourceId)
                if (!source) return null
                const sourceIndex = pdfSources.findIndex(
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
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setDropTargetPageId((current) =>
                          current === page.id ? null : current,
                        )
                      }
                    }}
                    onDrop={(event) => handlePageDrop(event, page.id)}
                  >
                    <div className="page-organizer-card-header">
                      <Badge className="page-position-badge">{index + 1}</Badge>
                      <button
                        type="button"
                        className="page-drag-handle"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', page.id)
                          setDraggedPageId(page.id)
                          selectOrganizerPage(page.id)
                        }}
                        onClick={() => selectOrganizerPage(page.id)}
                        onDragEnd={() => {
                          setDraggedPageId(null)
                          setDropTargetPageId(null)
                        }}
                        aria-label={`Seleccionar página ${index + 1} para moverla`}
                        title="Arrastra o selecciona y usa los controles inferiores"
                      >
                        <GripVertical aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="page-organizer-preview"
                      onClick={() => selectOrganizerPage(page.id)}
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
            {organizerAnnouncement}
          </p>

          <DialogFooter className="page-organizer-footer sm:justify-between">
            <div className="page-organizer-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedOrganizerIndex <= 0}
                onClick={() => moveSelectedPage(1)}
              >
                Al inicio
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={selectedOrganizerIndex <= 0}
                onClick={() => moveSelectedPage(selectedOrganizerIndex)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  selectedOrganizerIndex < 0 ||
                  selectedOrganizerIndex >= orderedPages.length - 1
                }
                onClick={() => moveSelectedPage(selectedOrganizerIndex + 2)}
              >
                Siguiente
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  selectedOrganizerIndex < 0 ||
                  selectedOrganizerIndex >= orderedPages.length - 1
                }
                onClick={() => moveSelectedPage(orderedPages.length)}
              >
                Al final
              </Button>
              <label className="page-position-control">
                <span>Posición</span>
                <Input
                  type="number"
                  min={1}
                  max={orderedPages.length}
                  inputMode="numeric"
                  value={targetPosition}
                  onChange={(event) => setTargetPosition(event.target.value)}
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
              onClick={() => setOrganizerOpen(false)}
            >
              <Check data-icon="inline-start" />
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                setSelectedAnnotationId(null)
                setTextDraft(null)
                setActiveTool('signature')
              }}
            />
          )}
        </DialogContent>
      </Dialog>

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

          <Button
            variant={activeTool === 'blur' ? 'secondary' : 'ghost'}
            size="sm"
            className={activeTool === 'blur' ? 'editor-tool-active' : ''}
            onClick={() => {
              setActiveTool((current) => (current === 'blur' ? null : 'blur'))
              setSelectedAnnotationId(null)
              setTextDraft(null)
            }}
            aria-pressed={activeTool === 'blur'}
          >
            <Blend data-icon="inline-start" />
            Difuminar
          </Button>

          <Button
            variant={activeTool === 'signature' ? 'secondary' : 'ghost'}
            size="sm"
            className={activeTool === 'signature' ? 'editor-tool-active' : ''}
            onClick={() => {
              setActiveTool(null)
              setSelectedAnnotationId(null)
              setTextDraft(null)
              setSignatureDialogOpen(true)
            }}
            aria-pressed={activeTool === 'signature'}
          >
            <SignatureIcon data-icon="inline-start" />
            Firma
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActiveTool(null)
              setSelectedAnnotationId(null)
              setTextDraft(null)
              setOrganizerOpen(true)
            }}
            disabled={!orderedPages.length}
          >
            <Files data-icon="inline-start" />
            Unir y ordenar
          </Button>

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
                : activeTool === 'blur'
                  ? 'Arrastra sobre la sección que quieres ocultar'
                  : activeTool === 'signature'
                    ? 'Haz clic o arrastra donde quieres colocar la firma'
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
                : selectedAnnotation.type === 'blur'
                  ? 'Arrastra el área difuminada · Usa las esquinas para ajustar'
                  : selectedAnnotation.type === 'signature'
                    ? 'Arrastra la firma · Usa las esquinas para ajustar'
                    : 'Arrastra para mover · Usa los puntos azules para redimensionar'}
            </>
          ) : (
            'Selecciona Texto, Formas, Difuminar o Firma para comenzar'
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
                onSelect={() => changeSelectedAnnotationLayer('front')}
              >
                <ChevronsUp />
                Traer al frente
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('forward')}
              >
                <LayersArrowUp />
                Subir un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('backward')}
              >
                <LayersArrowDown />
                Bajar un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('back')}
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

      {showBlurFormatter && (
        <div
          className="blur-format-toolbar"
          role="toolbar"
          aria-label="Formato del difuminado"
        >
          <span className="blur-format-label">Difuminado</span>

          <div className="blur-intensity-control">
            <span className="blur-control-label">Intensidad</span>
            <Slider
              className="w-36"
              min={4}
              max={24}
              step={1}
              value={[activeBlurFormat.intensity]}
              onValueChange={(value) =>
                applyBlurFormat({ intensity: value[0] ?? 12 })
              }
              aria-label="Intensidad del difuminado"
            />
            <span className="blur-control-value">
              {activeBlurFormat.intensity} px
            </span>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shape-position-trigger"
                disabled={!selectedBlur}
                aria-label="Cambiar posición del área difuminada"
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
                onSelect={() => changeSelectedAnnotationLayer('front')}
              >
                <ChevronsUp />
                Traer al frente
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('forward')}
              >
                <LayersArrowUp />
                Subir un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('backward')}
              >
                <LayersArrowDown />
                Bajar un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('back')}
              >
                <ChevronsDown />
                Enviar al fondo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => applyBlurFormat(defaultBlurFormat)}
            aria-label="Restablecer intensidad del difuminado"
            title="Restablecer intensidad"
          >
            <RotateCcw aria-hidden="true" />
          </Button>
        </div>
      )}

      {showSignatureFormatter && selectedSignature && (
        <div
          className="signature-format-toolbar"
          role="toolbar"
          aria-label="Formato de la firma"
        >
          <span className="signature-format-label">Firma</span>

          <div className="signature-color-control">
            <span className="signature-control-label">Tinta</span>
            {['#111827', '#1d4ed8'].map((color) => (
              <Button
                key={color}
                type="button"
                variant="outline"
                size="icon-sm"
                className={`signature-ink-swatch ${selectedSignature.format.color === color ? 'signature-ink-swatch--active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => applySignatureFormat({ color })}
                aria-label={color === '#111827' ? 'Tinta negra' : 'Tinta azul'}
              />
            ))}
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <div className="signature-width-control">
            <span className="signature-control-label">Grosor</span>
            <Slider
              className="signature-width-slider"
              min={2}
              max={14}
              step={1}
              value={[selectedSignature.format.strokeWidth]}
              onValueChange={(value) =>
                applySignatureFormat({
                  strokeWidth:
                    value[0] ?? selectedSignature.format.strokeWidth,
                })
              }
              aria-label="Grosor de la firma seleccionada"
            />
            <span className="signature-control-value">
              {selectedSignature.format.strokeWidth} px
            </span>
          </div>

          <Button
            type="button"
            variant={
              selectedSignature.format.effect !== 'clean'
                ? 'secondary'
                : 'outline'
            }
            size="sm"
            className={
              selectedSignature.format.effect !== 'clean'
                ? 'signature-natural-active'
                : ''
            }
            onClick={() =>
              applySignatureFormat({
                effect:
                  selectedSignature.format.effect !== 'clean'
                    ? 'clean'
                    : 'natural',
              })
            }
            aria-pressed={selectedSignature.format.effect !== 'clean'}
            title="Añade variaciones sutiles de presión y tinta"
          >
            <Feather data-icon="inline-start" />
            Tinta natural
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="shape-position-trigger"
                aria-label="Cambiar posición de la firma"
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
                onSelect={() => changeSelectedAnnotationLayer('front')}
              >
                <ChevronsUp />
                Traer al frente
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('forward')}
              >
                <LayersArrowUp />
                Subir un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('backward')}
              >
                <LayersArrowDown />
                Bajar un nivel
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-9 gap-2 px-2"
                onSelect={() => changeSelectedAnnotationLayer('back')}
              >
                <ChevronsDown />
                Enviar al fondo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSignatureDialogOpen(true)}
          >
            <PenLine data-icon="inline-start" />
            Crear otra
          </Button>
        </div>
      )}

      <div className="editor-canvas-area">
        {!pdfSources.length && !loadError && (
          <div className="editor-state">
            <LoaderCircle className="size-7 animate-spin text-[#ff5a45]" aria-hidden="true" />
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
          {annotations.length === 1 ? 'elemento agregado' : 'elementos agregados'}
        </span>
      </div>
    </div>
  )
}
