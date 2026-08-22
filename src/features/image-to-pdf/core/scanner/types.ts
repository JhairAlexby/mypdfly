export type ScannerPoint = {
  readonly x: number
  readonly y: number
}

export type ScannerCorners = readonly [
  ScannerPoint,
  ScannerPoint,
  ScannerPoint,
  ScannerPoint,
]

export type ScannerDetectionState = {
  readonly confidence: number
  readonly detected: boolean
}

export type ScannerDetection = ScannerDetectionState & {
  readonly corners: ScannerCorners
}

export type ImageScannerState = ScannerDetectionState & {
  readonly active: boolean
  readonly corners: ScannerCorners
}

export type ScannerWorkerStage =
  | 'loading-opencv'
  | 'detecting'
  | 'correcting-perspective'
  | 'filtering'
