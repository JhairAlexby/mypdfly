import { throwIfExportAborted } from '@/components/pdf-editor/export-cancellation'
import { getPerspectiveOutputSize } from './geometry'
import type { ScannerCorners, ScannerPoint } from './types'

export type PerspectiveCanvas = {
  readonly canvas: HTMLCanvasElement
  readonly logicalHeight: number
  readonly logicalWidth: number
}

export type PerspectiveRenderOptions = {
  readonly signal?: AbortSignal
}

const MAX_PERSPECTIVE_PIXELS = 8_000_000
const REMAP_TILE_HEIGHT = 128
const REMAP_TILE_WIDTH = 512
const SOURCE_SAMPLE_BORDER = 1

const yieldToBrowser = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

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
  if (!Number.isFinite(divisor) || Math.abs(divisor) < 0.000001) {
    throw new Error('No se pudo calcular una transformación de perspectiva válida.')
  }
  return {
    x: (homography.a * point.x + homography.b * point.y + homography.c) / divisor,
    y: (homography.d * point.x + homography.e * point.y + homography.f) / divisor,
  }
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const getSourceTileBounds = (
  inverseHomography: ReturnType<typeof getHomography>,
  destinationLeft: number,
  destinationTop: number,
  destinationRight: number,
  destinationBottom: number,
  sourceWidth: number,
  sourceHeight: number,
) => {
  const mappedCorners = [
    mapPoint(inverseHomography, { x: destinationLeft, y: destinationTop }),
    mapPoint(inverseHomography, { x: destinationRight, y: destinationTop }),
    mapPoint(inverseHomography, { x: destinationRight, y: destinationBottom }),
    mapPoint(inverseHomography, { x: destinationLeft, y: destinationBottom }),
  ]
  const left = clamp(
    Math.floor(Math.min(...mappedCorners.map((point) => point.x))) - SOURCE_SAMPLE_BORDER,
    0,
    sourceWidth - 1,
  )
  const top = clamp(
    Math.floor(Math.min(...mappedCorners.map((point) => point.y))) - SOURCE_SAMPLE_BORDER,
    0,
    sourceHeight - 1,
  )
  const right = clamp(
    Math.ceil(Math.max(...mappedCorners.map((point) => point.x))) + SOURCE_SAMPLE_BORDER,
    0,
    sourceWidth - 1,
  )
  const bottom = clamp(
    Math.ceil(Math.max(...mappedCorners.map((point) => point.y))) + SOURCE_SAMPLE_BORDER,
    0,
    sourceHeight - 1,
  )

  return {
    height: Math.max(1, bottom - top + 1),
    left,
    top,
    width: Math.max(1, right - left + 1),
  }
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
  const sourceTileCanvas = document.createElement('canvas')
  const sourceTileContext = sourceTileCanvas.getContext('2d')
  if (!sourceTileContext) {
    canvas.width = 1
    canvas.height = 1
    throw new Error('No se pudo preparar la corrección de perspectiva.')
  }

  const destinationRight = Math.max(0, canvas.width - 1)
  const destinationBottom = Math.max(0, canvas.height - 1)
  const destinationCorners: ScannerCorners = [
    { x: 0, y: 0 },
    { x: destinationRight, y: 0 },
    { x: destinationRight, y: destinationBottom },
    { x: 0, y: destinationBottom },
  ]
  const inverseHomography = getHomography(destinationCorners, corners)
  const horizontalTiles = Math.ceil(canvas.width / REMAP_TILE_WIDTH)
  const verticalTiles = Math.ceil(canvas.height / REMAP_TILE_HEIGHT)
  const totalTiles = horizontalTiles * verticalTiles
  let completedTiles = 0

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  try {
    for (let destinationTop = 0; destinationTop < canvas.height; destinationTop += REMAP_TILE_HEIGHT) {
      const tileHeight = Math.min(REMAP_TILE_HEIGHT, canvas.height - destinationTop)
      for (let destinationLeft = 0; destinationLeft < canvas.width; destinationLeft += REMAP_TILE_WIDTH) {
        throwIfExportAborted(options.signal)
        const tileWidth = Math.min(REMAP_TILE_WIDTH, canvas.width - destinationLeft)
        const sourceBounds = getSourceTileBounds(
          inverseHomography,
          destinationLeft,
          destinationTop,
          destinationLeft + tileWidth - 1,
          destinationTop + tileHeight - 1,
          sourceWidth,
          sourceHeight,
        )
        sourceTileCanvas.width = sourceBounds.width
        sourceTileCanvas.height = sourceBounds.height
        sourceTileContext.drawImage(
          source,
          sourceBounds.left,
          sourceBounds.top,
          sourceBounds.width,
          sourceBounds.height,
          0,
          0,
          sourceBounds.width,
          sourceBounds.height,
        )
        const sourcePixels = sourceTileContext.getImageData(
          0,
          0,
          sourceBounds.width,
          sourceBounds.height,
        ).data
        const destinationImage = context.createImageData(tileWidth, tileHeight)
        const destinationPixels = destinationImage.data

        for (let localY = 0; localY < tileHeight; localY += 1) {
          const destinationY = destinationTop + localY
          let sourceXNumerator =
            inverseHomography.a * destinationLeft +
            inverseHomography.b * destinationY +
            inverseHomography.c
          let sourceYNumerator =
            inverseHomography.d * destinationLeft +
            inverseHomography.e * destinationY +
            inverseHomography.f
          let sourceDivisor =
            inverseHomography.g * destinationLeft +
            inverseHomography.h * destinationY +
            1

          for (let localX = 0; localX < tileWidth; localX += 1) {
            if (!Number.isFinite(sourceDivisor) || Math.abs(sourceDivisor) < 0.000001) {
              throw new Error('No se pudo calcular una transformación de perspectiva válida.')
            }
            const sourceX = clamp(
              sourceXNumerator / sourceDivisor,
              0,
              sourceWidth - 1,
            )
            const sourceY = clamp(
              sourceYNumerator / sourceDivisor,
              0,
              sourceHeight - 1,
            )
            const sourceX0 = Math.floor(sourceX)
            const sourceY0 = Math.floor(sourceY)
            const sourceX1 = Math.min(sourceWidth - 1, sourceX0 + 1)
            const sourceY1 = Math.min(sourceHeight - 1, sourceY0 + 1)
            const horizontalRatio = sourceX - sourceX0
            const verticalRatio = sourceY - sourceY0
            const topLeftWeight = (1 - horizontalRatio) * (1 - verticalRatio)
            const topRightWeight = horizontalRatio * (1 - verticalRatio)
            const bottomLeftWeight = (1 - horizontalRatio) * verticalRatio
            const bottomRightWeight = horizontalRatio * verticalRatio
            const topLeftIndex = (
              (sourceY0 - sourceBounds.top) * sourceBounds.width +
              sourceX0 - sourceBounds.left
            ) * 4
            const topRightIndex = topLeftIndex + (sourceX1 - sourceX0) * 4
            const bottomLeftIndex = topLeftIndex +
              (sourceY1 - sourceY0) * sourceBounds.width * 4
            const bottomRightIndex = bottomLeftIndex + (sourceX1 - sourceX0) * 4
            const destinationIndex = (localY * tileWidth + localX) * 4
            const alpha = (
              sourcePixels[topLeftIndex + 3] * topLeftWeight +
              sourcePixels[topRightIndex + 3] * topRightWeight +
              sourcePixels[bottomLeftIndex + 3] * bottomLeftWeight +
              sourcePixels[bottomRightIndex + 3] * bottomRightWeight
            ) / 255

            for (let channel = 0; channel < 3; channel += 1) {
              const premultiplied = (
                sourcePixels[topLeftIndex + channel] * sourcePixels[topLeftIndex + 3] * topLeftWeight +
                sourcePixels[topRightIndex + channel] * sourcePixels[topRightIndex + 3] * topRightWeight +
                sourcePixels[bottomLeftIndex + channel] * sourcePixels[bottomLeftIndex + 3] * bottomLeftWeight +
                sourcePixels[bottomRightIndex + channel] * sourcePixels[bottomRightIndex + 3] * bottomRightWeight
              ) / 255
              destinationPixels[destinationIndex + channel] =
                premultiplied + 255 * (1 - alpha)
            }
            destinationPixels[destinationIndex + 3] = 255
            sourceXNumerator += inverseHomography.a
            sourceYNumerator += inverseHomography.d
            sourceDivisor += inverseHomography.g
          }
        }

        context.putImageData(destinationImage, destinationLeft, destinationTop)
        completedTiles += 1
        if (completedTiles < totalTiles) await yieldToBrowser()
      }
    }
    throwIfExportAborted(options.signal)
  } catch (error) {
    canvas.width = 1
    canvas.height = 1
    throw error
  } finally {
    sourceTileCanvas.width = 1
    sourceTileCanvas.height = 1
  }

  return {
    canvas,
    logicalHeight: logicalSize.height,
    logicalWidth: logicalSize.width,
  }
}
