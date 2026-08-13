import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export type ShapeTool = 'rectangle' | 'circle' | 'triangle' | 'line'

export type EditorTool = 'text' | 'blur' | 'signature' | ShapeTool | null

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'start' | 'end'

export type LayerAction = 'front' | 'forward' | 'backward' | 'back'

export type TextFontFamily =
  | 'helvetica'
  | 'times'
  | 'georgia'
  | 'courier'
  | 'verdana'

export type TextFormat = {
  fontFamily: TextFontFamily
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
}

export type ShapeFormat = {
  color: string
  opacity: number
  strokeWidth: number
}

export type BlurFormat = {
  intensity: number
}

export type SignatureEffect = 'clean' | 'natural'

export type SignatureFormat = {
  color: string
  strokeWidth: number
  effect: SignatureEffect
}

export type Point = {
  x: number
  y: number
}

export type TextAnnotation = {
  id: string
  pageId: string
  type: 'text'
  x: number
  y: number
  text: string
  format: TextFormat
  layer: number
}

export type ShapeAnnotation = {
  id: string
  pageId: string
  type: ShapeTool
  start: Point
  end: Point
  format: ShapeFormat
  layer: number
}

export type BlurAnnotation = {
  id: string
  pageId: string
  type: 'blur'
  start: Point
  end: Point
  format: BlurFormat
  layer: number
}

export type SignaturePoint = Point & {
  pressure: number
}

export type SignatureStroke = SignaturePoint[]

export type SignatureAnnotation = {
  id: string
  pageId: string
  type: 'signature'
  start: Point
  end: Point
  strokes: SignatureStroke[]
  format: SignatureFormat
  layer: number
}

export type SignatureTemplate = Pick<
  SignatureAnnotation,
  'strokes' | 'format'
>

export type PdfSource = {
  id: string
  file: File
  document: PDFDocumentProxy
}

export type PdfPageReference = {
  id: string
  sourceId: string
  sourcePageNumber: number
}

export type AreaAnnotation =
  | ShapeAnnotation
  | BlurAnnotation
  | SignatureAnnotation

export type Annotation = TextAnnotation | AreaAnnotation

export type TextDraft = {
  annotationId: string | null
  pageId: string
  x: number
  y: number
  value: string
  format: TextFormat
}

export type ShapeDraft = {
  type: ShapeTool
  start: Point
  end: Point
  format: ShapeFormat
}

export type BlurDraft = {
  type: 'blur'
  start: Point
  end: Point
  format: BlurFormat
}

export type SignatureDraft = {
  type: 'signature'
  start: Point
  end: Point
  strokes: SignatureStroke[]
  format: SignatureFormat
}

export type AreaDraft = ShapeDraft | BlurDraft | SignatureDraft

export type AnnotationInteraction =
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

export type ShapeMarkProps = {
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
}

export type BlurMarkProps = {
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
}

export type SignatureDrawingProps = {
  strokes: SignatureStroke[]
  format: SignatureFormat
}

export type SignaturePadProps = {
  initialFormat: SignatureFormat
  onCancel: () => void
  onUse: (strokes: SignatureStroke[], format: SignatureFormat) => void
}

export type SignatureMarkProps = {
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
}

export type PdfPageProps = {
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

export type PdfPageThumbnailProps = {
  document: PDFDocumentProxy
  pageNumber: number
}

export type PdfSummary = {
  fileCount: number
  pageCount: number
  totalSize: number
}

export type PdfEditorProps = {
  initialFile: File
  onSummaryChange?: (summary: PdfSummary) => void
}
