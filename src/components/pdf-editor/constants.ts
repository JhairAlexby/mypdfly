import { Circle, Minus, Square, Triangle } from 'lucide-react'

import type {
  BlurFormat,
  EditorTool,
  ShapeFormat,
  ShapeTool,
  SignatureFormat,
  TextFontFamily,
  TextFormat,
} from './types'

export const toolLabels: Record<Exclude<EditorTool, null>, string> = {
  text: 'Texto',
  blur: 'Difuminar',
  signature: 'Firma',
  rectangle: 'Rectángulo',
  circle: 'Círculo',
  triangle: 'Triángulo',
  line: 'Línea',
}

export const shapeOptions: Array<{
  value: ShapeTool
  label: string
  icon: typeof Square
}> = [
  { value: 'rectangle', label: 'Rectángulo', icon: Square },
  { value: 'circle', label: 'Círculo', icon: Circle },
  { value: 'triangle', label: 'Triángulo', icon: Triangle },
  { value: 'line', label: 'Línea', icon: Minus },
]

export const defaultTextFormat: TextFormat = {
  fontFamily: 'helvetica',
  fontSize: 14,
  color: '#111827',
  bold: false,
  italic: false,
  underline: false,
}

export const defaultShapeFormat: ShapeFormat = {
  color: '#ff5a45',
  opacity: 1,
  strokeWidth: 4,
}

export const defaultBlurFormat: BlurFormat = {
  intensity: 12,
}

export const defaultSignatureFormat: SignatureFormat = {
  color: '#111827',
  strokeWidth: 6,
  effect: 'natural',
}

export const fontFamilies: Array<{
  value: TextFontFamily
  label: string
  css: string
}> = [
  { value: 'helvetica', label: 'Helvetica', css: 'Arial, Helvetica, sans-serif' },
  {
    value: 'times',
    label: 'Times New Roman',
    css: '"Times New Roman", Times, serif',
  },
  { value: 'georgia', label: 'Georgia', css: 'Georgia, serif' },
  {
    value: 'courier',
    label: 'Courier',
    css: '"Courier New", Courier, monospace',
  },
  { value: 'verdana', label: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
]

export const fontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64]

export const textColors = [
  '#111827',
  '#475569',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
]

export const shapeStrokeWidths = [1, 2, 3, 4, 6, 8, 12]

export const pdfSourceColors = [
  '#ff5a45',
  '#2563eb',
  '#16a34a',
  '#7c3aed',
  '#ca8a04',
]
