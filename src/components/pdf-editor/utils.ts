import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

import { fontFamilies } from './constants'
import type {
  Annotation,
  AreaDraft,
  BlurAnnotation,
  Point,
  ShapeAnnotation,
  SignatureAnnotation,
  SignaturePoint,
  SignatureStroke,
  TextAnnotation,
  TextFormat,
} from './types'

export const getTextRenderStyle = (
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

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value))

export const getNextLayer = (annotations: Annotation[], pageId: string) =>
  Math.max(
    0,
    ...annotations
      .filter((annotation) => annotation.pageId === pageId)
      .map((annotation) => annotation.layer),
  ) + 1

export const isTextAnnotation = (
  annotation: Annotation,
): annotation is TextAnnotation => annotation.type === 'text'

export const isShapeAnnotation = (
  annotation: Annotation,
): annotation is ShapeAnnotation =>
  annotation.type === 'rectangle' ||
  annotation.type === 'circle' ||
  annotation.type === 'triangle' ||
  annotation.type === 'line'

export const isBlurAnnotation = (
  annotation: Annotation,
): annotation is BlurAnnotation => annotation.type === 'blur'

export const isSignatureAnnotation = (
  annotation: Annotation,
): annotation is SignatureAnnotation => annotation.type === 'signature'

export const getPoint = (
  event: Pick<
    ReactPointerEvent<Element> | ReactMouseEvent<Element>,
    'clientX' | 'clientY'
  >,
  element: HTMLDivElement,
): Point => {
  const bounds = element.getBoundingClientRect()

  return {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height),
  }
}

export const normalizeArea = (area: AreaDraft): AreaDraft => {
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

export const getSignaturePath = (stroke: SignatureStroke) => {
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

export const getNaturalInkVariation = (
  strokeIndex: number,
  segmentIndex: number,
) => {
  const value =
    Math.sin((strokeIndex + 1) * 12.9898 + (segmentIndex + 1) * 78.233) *
    43758.5453
  return value - Math.floor(value)
}
