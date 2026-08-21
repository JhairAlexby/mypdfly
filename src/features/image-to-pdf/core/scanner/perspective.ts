import { throwIfExportAborted } from '@/components/pdf-editor/export-cancellation'
import { getPerspectiveOutputSize } from './geometry'
import type { ScannerCorners, ScannerPoint } from './types'

type AffineMatrix = {
  readonly a: number
  readonly b: number
  readonly c: number
  readonly d: number
  readonly e: number
  readonly f: number
}

export type PerspectiveCanvas = {
  readonly canvas: HTMLCanvasElement
  readonly logicalHeight: number
  readonly logicalWidth: number
}

export type PerspectiveRenderOptions = {
  readonly signal?: AbortSignal
}

const MAX_PERSPECTIVE_PIXELS = 8_000_000
const MAX_GRID_SEGMENTS = 48
const MIN_GRID_SEGMENTS = 12
const GRID_PIXELS = 160

const determinant3 = (
  first: readonly [number, number, number],
  second: readonly [number, number, number],
  third: readonly [number, number, number],
) =>
  first[0] * (second[1] * third[2] - second[2] * third[1]) -
  first[1] * (second[0] * third[2] - second[2] * third[0]) +
  first[2] * (second[0] * third[1] - second[1] * third[0])

const solveAffine = (
  source: readonly [ScannerPoint, ScannerPoint, ScannerPoint],
  target: readonly [ScannerPoint, ScannerPoint, ScannerPoint],
): AffineMatrix => {
  const matrix: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ] = [
    [source[0].x, source[0].y, 1],
    [source[1].x, source[1].y, 1],
    [source[2].x, source[2].y, 1],
  ]
  const determinant = determinant3(matrix[0], matrix[1], matrix[2])
  if (Math.abs(determinant) < 0.000001) {
    throw new Error('No se pudo calcular una transformación de perspectiva válida.')
  }

  const solve = (values: readonly [number, number, number]) => {
    const x = determinant3(
      [values[0], matrix[0][1], matrix[0][2]],
      [values[1], matrix[1][1], matrix[1][2]],
      [values[2], matrix[2][1], matrix[2][2]],
    ) / determinant
    const y = determinant3(
      [matrix[0][0], values[0], matrix[0][2]],
      [matrix[1][0], values[1], matrix[1][2]],
      [matrix[2][0], values[2], matrix[2][2]],
    ) / determinant
    const offset = determinant3(
      [matrix[0][0], matrix[0][1], values[0]],
      [matrix[1][0], matrix[1][1], values[1]],
      [matrix[2][0], matrix[2][1], values[2]],
    ) / determinant
    return [x, y, offset] as const
  }

  const x = solve([target[0].x, target[1].x, target[2].x])
  const y = solve([target[0].y, target[1].y, target[2].y])
  return {
    a: x[0],
    b: y[0],
    c: x[1],
    d: y[1],
    e: x[2],
    f: y[2],
  }
}

const getHomography = (
  source: ScannerCorners,
  destination: ScannerCorners,
) => {
  const matrix: number[][] = []
  const values: number[] = []

  source.forEach((point, index) => {
    const target = destination[index]
    matrix.push([
      point.x,
      point.y,
      1,
      0,
      0,
      0,
      -point.x * target.x,
      -point.y * target.x,
    ])
    values.push(target.x)
    matrix.push([
      0,
      0,
      0,
      point.x,
      point.y,
      1,
      -point.x * target.y,
      -point.y * target.y,
    ])
    values.push(target.y)
  })

  for (let column = 0; column < 8; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 8; row += 1) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) {
        pivot = row
      }
    }
    if (Math.abs(matrix[pivot][column]) < 0.000001) {
      throw new Error('No se pudo calcular una transformación de perspectiva válida.')
    }

    ;[matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]]
    ;[values[column], values[pivot]] = [values[pivot], values[column]]
    const divisor = matrix[column][column]
    for (let inner = column; inner < 8; inner += 1) {
      matrix[column][inner] /= divisor
    }
    values[column] /= divisor

    for (let row = 0; row < 8; row += 1) {
      if (row === column) continue
      const factor = matrix[row][column]
      for (let inner = column; inner < 8; inner += 1) {
        matrix[row][inner] -= factor * matrix[column][inner]
      }
      values[row] -= factor * values[column]
    }
  }

  return {
    a: values[0],
    b: values[1],
    c: values[2],
    d: values[3],
    e: values[4],
    f: values[5],
    g: values[6],
    h: values[7],
  }
}

const mapPoint = (
  homography: ReturnType<typeof getHomography>,
  point: ScannerPoint,
): ScannerPoint => {
  const divisor = homography.g * point.x + homography.h * point.y + 1
  return {
    x: (homography.a * point.x + homography.b * point.y + homography.c) / divisor,
    y: (homography.d * point.x + homography.e * point.y + homography.f) / divisor,
  }
}

const drawTriangle = (
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceTriangle: readonly [ScannerPoint, ScannerPoint, ScannerPoint],
  destinationTriangle: readonly [ScannerPoint, ScannerPoint, ScannerPoint],
  sourceWidth: number,
  sourceHeight: number,
) => {
  const transform = solveAffine(sourceTriangle, destinationTriangle)
  const sourceX = Math.min(...sourceTriangle.map((point) => point.x))
  const sourceY = Math.min(...sourceTriangle.map((point) => point.y))
  const sourceRight = Math.max(...sourceTriangle.map((point) => point.x))
  const sourceBottom = Math.max(...sourceTriangle.map((point) => point.y))
  const width = Math.max(1, sourceRight - sourceX)
  const height = Math.max(1, sourceBottom - sourceY)

  context.save()
  context.beginPath()
  context.moveTo(destinationTriangle[0].x, destinationTriangle[0].y)
  context.lineTo(destinationTriangle[1].x, destinationTriangle[1].y)
  context.lineTo(destinationTriangle[2].x, destinationTriangle[2].y)
  context.closePath()
  context.clip()
  context.setTransform(
    transform.a,
    transform.b,
    transform.c,
    transform.d,
    transform.e,
    transform.f,
  )
  context.drawImage(
    source,
    sourceX,
    sourceY,
    Math.min(width, sourceWidth - sourceX),
    Math.min(height, sourceHeight - sourceY),
    sourceX,
    sourceY,
    Math.min(width, sourceWidth - sourceX),
    Math.min(height, sourceHeight - sourceY),
  )
  context.restore()
}

export const renderPerspectiveCanvas = async (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  corners: ScannerCorners,
  options: PerspectiveRenderOptions = {},
): Promise<PerspectiveCanvas> => {
  const logicalSize = getPerspectiveOutputSize(corners)
  const renderScale = Math.min(
    1,
    Math.sqrt(MAX_PERSPECTIVE_PIXELS / (logicalSize.width * logicalSize.height)),
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(logicalSize.width * renderScale))
  canvas.height = Math.max(1, Math.round(logicalSize.height * renderScale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo crear la vista previa de perspectiva.')

  const scaleDestination = (point: ScannerPoint): ScannerPoint => ({
    x: point.x * renderScale,
    y: point.y * renderScale,
  })
  const destinationRight = Math.max(0, logicalSize.width - 1)
  const destinationBottom = Math.max(0, logicalSize.height - 1)
  const destinationCorners: ScannerCorners = [
    { x: 0, y: 0 },
    { x: destinationRight, y: 0 },
    { x: destinationRight, y: destinationBottom },
    { x: 0, y: destinationBottom },
  ]
  const homography = getHomography(corners, destinationCorners)
  const gridSegments = Math.min(
    MAX_GRID_SEGMENTS,
    Math.max(
      MIN_GRID_SEGMENTS,
      Math.ceil(Math.max(sourceWidth, sourceHeight) / GRID_PIXELS),
    ),
  )

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true

  for (let row = 0; row < gridSegments; row += 1) {
    throwIfExportAborted(options.signal)
    for (let column = 0; column < gridSegments; column += 1) {
      const sourceLeft = (column / gridSegments) * sourceWidth
      const sourceRight = ((column + 1) / gridSegments) * sourceWidth
      const sourceTop = (row / gridSegments) * sourceHeight
      const sourceBottom = ((row + 1) / gridSegments) * sourceHeight
      const topLeft = { x: sourceLeft, y: sourceTop }
      const topRight = { x: sourceRight, y: sourceTop }
      const bottomRight = { x: sourceRight, y: sourceBottom }
      const bottomLeft = { x: sourceLeft, y: sourceBottom }
      const destinationTopLeft = scaleDestination(mapPoint(homography, topLeft))
      const destinationTopRight = scaleDestination(mapPoint(homography, topRight))
      const destinationBottomRight = scaleDestination(mapPoint(homography, bottomRight))
      const destinationBottomLeft = scaleDestination(mapPoint(homography, bottomLeft))

      drawTriangle(
        context,
        source,
        [topLeft, topRight, bottomRight],
        [destinationTopLeft, destinationTopRight, destinationBottomRight],
        sourceWidth,
        sourceHeight,
      )
      drawTriangle(
        context,
        source,
        [topLeft, bottomRight, bottomLeft],
        [destinationTopLeft, destinationBottomRight, destinationBottomLeft],
        sourceWidth,
        sourceHeight,
      )
    }
  }

  return {
    canvas,
    logicalHeight: logicalSize.height,
    logicalWidth: logicalSize.width,
  }
}
