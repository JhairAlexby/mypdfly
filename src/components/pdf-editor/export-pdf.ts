import { fontFamilies } from './constants'
import type {
  Annotation,
  BlurAnnotation,
  PdfPageReference,
  PdfSource,
  ShapeAnnotation,
  SignatureAnnotation,
  SignaturePoint,
  TextAnnotation,
} from './types'
import { getNaturalInkVariation } from './utils'

type ExportPdfOptions = {
  sources: PdfSource[]
  pages: PdfPageReference[]
  annotations: Annotation[]
  fileName: string
  onProgress?: (currentPage: number, totalPages: number) => void
}

const DEFAULT_EXPORT_SCALE = 2
const MAX_CANVAS_EDGE = 8192
const MAX_CANVAS_PIXELS = 16_000_000

const getExportScale = (width: number, height: number) =>
  Math.min(
    DEFAULT_EXPORT_SCALE,
    MAX_CANVAS_EDGE / width,
    MAX_CANVAS_EDGE / height,
    Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
  )

const getCanvasContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el lienzo de exportación.')
  return context
}

const drawShape = (
  context: CanvasRenderingContext2D,
  annotation: ShapeAnnotation,
  width: number,
  height: number,
  exportScale: number,
) => {
  const startX = annotation.start.x * width
  const startY = annotation.start.y * height
  const endX = annotation.end.x * width
  const endY = annotation.end.y * height
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const shapeWidth = Math.abs(endX - startX)
  const shapeHeight = Math.abs(endY - startY)

  context.save()
  context.globalAlpha = annotation.format.opacity
  context.fillStyle = annotation.format.color
  context.strokeStyle = annotation.format.color
  context.lineWidth = annotation.format.strokeWidth * exportScale
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.beginPath()

  if (annotation.type === 'line') {
    context.moveTo(startX, startY)
    context.lineTo(endX, endY)
    context.stroke()
  } else if (annotation.type === 'circle') {
    context.ellipse(
      x + shapeWidth / 2,
      y + shapeHeight / 2,
      shapeWidth / 2,
      shapeHeight / 2,
      0,
      0,
      Math.PI * 2,
    )
    context.fill()
    context.stroke()
  } else if (annotation.type === 'triangle') {
    context.moveTo(x + shapeWidth / 2, y)
    context.lineTo(x + shapeWidth, y + shapeHeight)
    context.lineTo(x, y + shapeHeight)
    context.closePath()
    context.fill()
    context.stroke()
  } else {
    const radius = Math.min(8 * exportScale, shapeWidth / 2, shapeHeight / 2)
    context.roundRect(x, y, shapeWidth, shapeHeight, radius)
    context.fill()
    context.stroke()
  }

  context.restore()
}

const drawBlur = (
  context: CanvasRenderingContext2D,
  annotation: BlurAnnotation,
  width: number,
  height: number,
  exportScale: number,
) => {
  const x = Math.min(annotation.start.x, annotation.end.x) * width
  const y = Math.min(annotation.start.y, annotation.end.y) * height
  const blurWidth = Math.abs(annotation.end.x - annotation.start.x) * width
  const blurHeight = Math.abs(annotation.end.y - annotation.start.y) * height
  if (blurWidth < 1 || blurHeight < 1) return

  const padding = Math.ceil(annotation.format.intensity * exportScale * 2)
  const sourceX = Math.max(0, Math.floor(x - padding))
  const sourceY = Math.max(0, Math.floor(y - padding))
  const sourceWidth = Math.min(
    width - sourceX,
    Math.ceil(blurWidth + padding * 2),
  )
  const sourceHeight = Math.min(
    height - sourceY,
    Math.ceil(blurHeight + padding * 2),
  )
  const buffer = document.createElement('canvas')
  buffer.width = sourceWidth
  buffer.height = sourceHeight
  const bufferContext = getCanvasContext(buffer)
  bufferContext.drawImage(
    context.canvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  )

  context.save()
  context.beginPath()
  context.rect(x, y, blurWidth, blurHeight)
  context.clip()
  context.filter = `blur(${annotation.format.intensity * exportScale}px)`
  context.drawImage(buffer, sourceX, sourceY)
  context.filter = 'none'
  context.fillStyle = 'rgba(241, 245, 249, 0.16)'
  context.fillRect(x, y, blurWidth, blurHeight)
  context.restore()
}

const drawSignatureSegment = (
  context: CanvasRenderingContext2D,
  previousPoint: SignaturePoint,
  point: SignaturePoint,
  annotation: SignatureAnnotation,
  width: number,
  height: number,
  strokeIndex: number,
  segmentIndex: number,
  segmentCount: number,
  inkScale: number,
) => {
  const pressure = (previousPoint.pressure + point.pressure) / 2
  const edgeDistance = Math.min(segmentIndex + 1, segmentCount - segmentIndex)
  const taper = Math.min(1, 0.68 + edgeDistance * 0.14)
  const variation = getNaturalInkVariation(strokeIndex, segmentIndex)
  const opacityVariation = getNaturalInkVariation(strokeIndex + 31, segmentIndex)
  const naturalWidth =
    annotation.format.strokeWidth *
    (0.72 + pressure * 0.56) *
    (0.94 + variation * 0.12) *
    taper

  context.globalAlpha = 0.9 + opacityVariation * 0.1
  context.lineWidth = naturalWidth * inkScale
  context.beginPath()
  context.moveTo(previousPoint.x * width, previousPoint.y * height)
  context.lineTo(point.x * width, point.y * height)
  context.stroke()
}

const drawSignature = (
  context: CanvasRenderingContext2D,
  annotation: SignatureAnnotation,
  pageWidth: number,
  pageHeight: number,
) => {
  const left = Math.min(annotation.start.x, annotation.end.x) * pageWidth
  const top = Math.min(annotation.start.y, annotation.end.y) * pageHeight
  const width = Math.abs(annotation.end.x - annotation.start.x) * pageWidth
  const height = Math.abs(annotation.end.y - annotation.start.y) * pageHeight
  const inkScale = Math.sqrt((width / 1000) * (height / 300))

  context.save()
  context.translate(left, top)
  context.strokeStyle = annotation.format.color
  context.fillStyle = annotation.format.color
  context.lineCap = 'round'
  context.lineJoin = 'round'

  annotation.strokes.forEach((stroke, strokeIndex) => {
    if (!stroke.length) return

    if (stroke.length === 1) {
      const point = stroke[0]
      const pointWidth =
        annotation.format.effect !== 'clean'
          ? annotation.format.strokeWidth *
            (0.72 + point.pressure * 0.56) *
            (0.94 + getNaturalInkVariation(strokeIndex, 0) * 0.12)
          : annotation.format.strokeWidth * (0.85 + point.pressure * 0.3)
      context.beginPath()
      context.arc(
        point.x * width,
        point.y * height,
        (pointWidth * inkScale) / 2,
        0,
        Math.PI * 2,
      )
      context.fill()
      return
    }

    if (annotation.format.effect !== 'clean') {
      stroke.slice(1).forEach((point, segmentIndex) => {
        drawSignatureSegment(
          context,
          stroke[segmentIndex],
          point,
          annotation,
          width,
          height,
          strokeIndex,
          segmentIndex,
          stroke.length - 1,
          inkScale,
        )
      })
      context.globalAlpha = 1
      return
    }

    const averagePressure =
      stroke.reduce((total, point) => total + point.pressure, 0) / stroke.length
    context.lineWidth =
      annotation.format.strokeWidth *
      (0.85 + averagePressure * 0.3) *
      inkScale
    context.beginPath()
    context.moveTo(stroke[0].x * width, stroke[0].y * height)
    for (let index = 1; index < stroke.length - 1; index += 1) {
      const point = stroke[index]
      const nextPoint = stroke[index + 1]
      context.quadraticCurveTo(
        point.x * width,
        point.y * height,
        ((point.x + nextPoint.x) / 2) * width,
        ((point.y + nextPoint.y) / 2) * height,
      )
    }
    const lastPoint = stroke[stroke.length - 1]
    context.lineTo(lastPoint.x * width, lastPoint.y * height)
    context.stroke()
  })

  context.restore()
}

const drawText = (
  context: CanvasRenderingContext2D,
  annotation: TextAnnotation,
  width: number,
  height: number,
  exportScale: number,
) => {
  const family =
    fontFamilies.find((font) => font.value === annotation.format.fontFamily)
      ?.css ?? fontFamilies[0].css
  const fontSize = annotation.format.fontSize * exportScale
  const fontStyle = annotation.format.italic ? 'italic' : 'normal'
  const fontWeight = annotation.format.bold ? '700' : '400'
  const x = annotation.x * width
  const maxWidth = Math.max(1, width * 0.7)
  const lineHeight = fontSize * 1.3
  const words = annotation.text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  context.save()
  context.fillStyle = annotation.format.color
  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${family}`
  context.textBaseline = 'top'

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (currentLine && context.measureText(candidate).width > maxWidth) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = candidate
    }
  })
  if (currentLine) lines.push(currentLine)

  const firstLineY = annotation.y * height - lineHeight * 0.08
  lines.forEach((line, index) => {
    const y = firstLineY + index * lineHeight
    context.fillText(line, x, y, maxWidth)

    if (annotation.format.underline) {
      const textWidth = Math.min(context.measureText(line).width, maxWidth)
      context.strokeStyle = annotation.format.color
      context.lineWidth = Math.max(1, fontSize / 16)
      context.beginPath()
      context.moveTo(x, y + fontSize * 1.08)
      context.lineTo(x + textWidth, y + fontSize * 1.08)
      context.stroke()
    }
  })

  context.restore()
}

const drawAnnotation = (
  context: CanvasRenderingContext2D,
  annotation: Annotation,
  width: number,
  height: number,
  exportScale: number,
) => {
  if (annotation.type === 'text') {
    drawText(context, annotation, width, height, exportScale)
  } else if (annotation.type === 'blur') {
    drawBlur(context, annotation, width, height, exportScale)
  } else if (annotation.type === 'signature') {
    drawSignature(context, annotation, width, height)
  } else {
    drawShape(context, annotation, width, height, exportScale)
  }
}

const canvasToPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo convertir la página a imagen.'))
    }, 'image/png')
  })

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const getEditedPdfFileName = (fileName: string, combined: boolean) => {
  const baseName = fileName
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  const safeBaseName = baseName || 'documento'
  return `${safeBaseName}${combined ? '-combinado' : ''}-editado.pdf`
}

export async function exportEditedPdf({
  sources,
  pages,
  annotations,
  fileName,
  onProgress,
}: ExportPdfOptions) {
  const { PDFDocument } = await import('pdf-lib')
  const output = await PDFDocument.create()
  const sourcesById = new Map(sources.map((source) => [source.id, source]))

  for (const [pageIndex, pageReference] of pages.entries()) {
    const source = sourcesById.get(pageReference.sourceId)
    if (!source) throw new Error('No se encontró una de las páginas del documento.')

    onProgress?.(pageIndex + 1, pages.length)
    const sourcePage = await source.document.getPage(
      pageReference.sourcePageNumber,
    )
    const logicalViewport = sourcePage.getViewport({ scale: 1 })
    const exportScale = getExportScale(
      logicalViewport.width,
      logicalViewport.height,
    )
    const renderViewport = sourcePage.getViewport({ scale: exportScale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(renderViewport.width)
    canvas.height = Math.ceil(renderViewport.height)
    const context = getCanvasContext(canvas)

    await sourcePage.render({ canvas, viewport: renderViewport }).promise

    annotations
      .filter((annotation) => annotation.pageId === pageReference.id)
      .sort((first, second) => first.layer - second.layer)
      .forEach((annotation) =>
        drawAnnotation(
          context,
          annotation,
          canvas.width,
          canvas.height,
          exportScale,
        ),
      )

    const imageBlob = await canvasToPng(canvas)
    const imageBytes = await imageBlob.arrayBuffer()
    const image = await output.embedPng(imageBytes)
    const outputPage = output.addPage([
      logicalViewport.width,
      logicalViewport.height,
    ])
    outputPage.drawImage(image, {
      x: 0,
      y: 0,
      width: logicalViewport.width,
      height: logicalViewport.height,
    })

    canvas.width = 1
    canvas.height = 1
  }

  const bytes = await output.save()
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: 'application/pdf',
  })
  downloadBlob(blob, fileName)
}
