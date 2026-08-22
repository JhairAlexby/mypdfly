import type {
  ImageScannerState,
  ScannerCorners,
  ScannerDetection,
  ScannerDetectionState,
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

export const createFullScannerCorners = (
  width: number,
  height: number,
): ScannerCorners => [
  { x: 0, y: 0 },
  { x: Math.max(0, width - 1), y: 0 },
  { x: Math.max(0, width - 1), y: Math.max(0, height - 1) },
  { x: 0, y: Math.max(0, height - 1) },
]

export const createFullImageDetection = (
  width: number,
  height: number,
): ScannerDetection => ({
  confidence: 0,
  corners: createFullScannerCorners(width, height),
  detected: false,
})

export const createImageScannerState = (
  width: number,
  height: number,
): ImageScannerState => ({
  active: false,
  ...createFullImageDetection(width, height),
})

export const createScannerStateFromDetection = (
  corners: ScannerCorners,
  detection: ScannerDetectionState,
): ImageScannerState => ({
  active: true,
  confidence: detection.confidence,
  corners,
  detected: detection.detected,
})

export const clampScannerPoint = (
  point: ScannerPoint,
  width: number,
  height: number,
): ScannerPoint => ({
  x: Math.min(Math.max(0, point.x), Math.max(0, width - 1)),
  y: Math.min(Math.max(0, point.y), Math.max(0, height - 1)),
})

export const setScannerCorner = (
  corners: ScannerCorners,
  index: number,
  point: ScannerPoint,
  width: number,
  height: number,
): ScannerCorners => {
  if (index < 0 || index > 3) return corners

  const next = [...corners] as ScannerPoint[]
  next[index] = clampScannerPoint(point, width, height)
  return next as unknown as ScannerCorners
}

export const scaleScannerCorners = (
  corners: ScannerCorners,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): ScannerCorners =>
  corners.map((point) => ({
    x: point.x * (targetWidth / sourceWidth),
    y: point.y * (targetHeight / sourceHeight),
  })) as unknown as ScannerCorners

export const isScannerQuadrilateralValid = (corners: ScannerCorners) => {
  const signedArea = corners.reduce((area, point, index) => {
    const next = corners[(index + 1) % corners.length]
    return area + point.x * next.y - next.x * point.y
  }, 0)

  return Math.abs(signedArea) >= 4
}

export const getDocumentConfidence = (
  contourArea: number,
  imageArea: number,
) => {
  if (contourArea <= 0 || imageArea <= 0) return 0

  const areaRatio = contourArea / imageArea
  return Math.round(Math.min(1, Math.max(0, (areaRatio - 0.08) / 0.72)) * 1000) / 1000
}
