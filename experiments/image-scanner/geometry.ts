import type {
  ScannerCorners,
  ScannerDetection,
  ScannerPoint,
} from './types'

const distance = (first: ScannerPoint, second: ScannerPoint) =>
  Math.hypot(second.x - first.x, second.y - first.y)

export const orderScannerCorners = (
  points: readonly ScannerPoint[],
): ScannerCorners => {
  if (points.length !== 4) {
    throw new Error('Se necesitan exactamente cuatro esquinas.')
  }

  const center = points.reduce(
    (current, point) => ({
      x: current.x + point.x / points.length,
      y: current.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  )
  const clockwise = [...points].sort(
    (first, second) =>
      Math.atan2(first.y - center.y, first.x - center.x) -
      Math.atan2(second.y - center.y, second.x - center.x),
  )
  const topLeftIndex = clockwise.reduce(
    (bestIndex, point, index, candidates) =>
      point.x + point.y < candidates[bestIndex].x + candidates[bestIndex].y
        ? index
        : bestIndex,
    0,
  )
  const ordered = [
    ...clockwise.slice(topLeftIndex),
    ...clockwise.slice(0, topLeftIndex),
  ]

  return ordered as unknown as ScannerCorners
}

export const getPerspectiveOutputSize = (corners: ScannerCorners) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners

  return {
    height: Math.max(
      1,
      Math.round(
        Math.max(
          distance(topLeft, bottomLeft),
          distance(topRight, bottomRight),
        ),
      ),
    ),
    width: Math.max(
      1,
      Math.round(
        Math.max(
          distance(topLeft, topRight),
          distance(bottomLeft, bottomRight),
        ),
      ),
    ),
  }
}

export const createFullImageDetection = (
  width: number,
  height: number,
): ScannerDetection => ({
  confidence: 0,
  corners: [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ],
  detected: false,
})

export const getDocumentConfidence = (
  contourArea: number,
  imageArea: number,
) => {
  if (contourArea <= 0 || imageArea <= 0) return 0

  const areaRatio = contourArea / imageArea
  return Math.round(Math.min(1, Math.max(0, (areaRatio - 0.08) / 0.72)) * 1000) / 1000
}
