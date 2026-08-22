import type { ScannerCorners, ScannerPoint } from './types'

export const SYNTHETIC_FIXTURE_WIDTH = 1280
export const SYNTHETIC_FIXTURE_HEIGHT = 900

export const SYNTHETIC_DOCUMENT_CORNERS: ScannerCorners = [
  { x: 214, y: 112 },
  { x: 1082, y: 176 },
  { x: 1006, y: 782 },
  { x: 158, y: 724 },
]

const interpolate = (
  start: ScannerPoint,
  end: ScannerPoint,
  amount: number,
) => ({
  x: start.x + (end.x - start.x) * amount,
  y: start.y + (end.y - start.y) * amount,
})

const traceDocument = (
  context: CanvasRenderingContext2D,
  corners: ScannerCorners,
) => {
  context.beginPath()
  context.moveTo(corners[0].x, corners[0].y)
  corners.slice(1).forEach((point) => context.lineTo(point.x, point.y))
  context.closePath()
}

export const drawSyntheticDocumentFixture = (canvas: HTMLCanvasElement) => {
  canvas.width = SYNTHETIC_FIXTURE_WIDTH
  canvas.height = SYNTHETIC_FIXTURE_HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('No se pudo preparar el fixture del escáner.')

  const desk = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  desk.addColorStop(0, '#27364d')
  desk.addColorStop(0.52, '#52637a')
  desk.addColorStop(1, '#1d293b')
  context.fillStyle = desk
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.globalAlpha = 0.16
  for (let x = -canvas.height; x < canvas.width; x += 42) {
    context.fillStyle = x % 84 === 0 ? '#ffffff' : '#0f172a'
    context.fillRect(x, 0, 16, canvas.height)
  }
  context.globalAlpha = 1

  context.save()
  context.translate(18, 22)
  context.filter = 'blur(16px)'
  context.fillStyle = 'rgba(0, 0, 0, 0.5)'
  traceDocument(context, SYNTHETIC_DOCUMENT_CORNERS)
  context.fill()
  context.restore()

  const paper = context.createLinearGradient(180, 120, 1030, 760)
  paper.addColorStop(0, '#fffdf7')
  paper.addColorStop(0.55, '#f4f0e5')
  paper.addColorStop(1, '#d8d3c7')
  context.fillStyle = paper
  traceDocument(context, SYNTHETIC_DOCUMENT_CORNERS)
  context.fill()

  context.save()
  traceDocument(context, SYNTHETIC_DOCUMENT_CORNERS)
  context.clip()

  const [topLeft, topRight, bottomRight, bottomLeft] =
    SYNTHETIC_DOCUMENT_CORNERS
  const linePositions = [0.18, 0.26, 0.38, 0.46, 0.54, 0.66, 0.74, 0.82]
  context.lineCap = 'round'
  linePositions.forEach((amount, index) => {
    const left = interpolate(topLeft, bottomLeft, amount)
    const right = interpolate(topRight, bottomRight, amount)
    context.strokeStyle = index < 2 ? '#0f172a' : '#475569'
    context.lineWidth = index < 2 ? 13 : 7
    context.beginPath()
    context.moveTo(left.x + 76, left.y)
    context.lineTo(right.x - (index % 3 === 0 ? 190 : 82), right.y)
    context.stroke()
  })

  const sealCenter = interpolate(
    interpolate(topLeft, bottomLeft, 0.58),
    interpolate(topRight, bottomRight, 0.58),
    0.78,
  )
  context.strokeStyle = '#dc2626'
  context.lineWidth = 10
  context.beginPath()
  context.arc(sealCenter.x, sealCenter.y, 52, 0, Math.PI * 2)
  context.stroke()
  context.restore()

  context.strokeStyle = '#f8fafc'
  context.lineWidth = 5
  traceDocument(context, SYNTHETIC_DOCUMENT_CORNERS)
  context.stroke()

  return context.getImageData(0, 0, canvas.width, canvas.height)
}
