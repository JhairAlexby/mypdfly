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

export type ScannerFilter = 'document-clean'

export type ScannerProcessOptions = {
  readonly benchmarkPasses?: number
  readonly filter: ScannerFilter
}

export type ScannerInput = {
  readonly height: number
  readonly pixels: ArrayBuffer
  readonly width: number
}

export type ScannerDetection = {
  readonly confidence: number
  readonly corners: ScannerCorners
  readonly detected: boolean
}

export type ScannerProcessingMetrics = {
  readonly detectMs: number
  readonly filterMs: number
  readonly inputPixels: number
  readonly opencvLoadMs: number
  readonly opencvVersion: string
  readonly perspectiveMs: number
  readonly totalMs: number
  readonly wasmHeapAfterBytes: number | null
  readonly wasmHeapBeforeBytes: number | null
}

export type ScannerProcessResult = {
  readonly detection: ScannerDetection
  readonly filter: ScannerFilter
  readonly height: number
  readonly metrics: ScannerProcessingMetrics
  readonly output: ArrayBuffer
  readonly outputStats: {
    readonly blackPixelRatio: number
    readonly whitePixelRatio: number
  }
  readonly perspectiveApplied: boolean
  readonly width: number
}

export type ScannerWorkerStage =
  | 'loading-opencv'
  | 'detecting'
  | 'correcting-perspective'
  | 'filtering'

export type ScannerWorkerRequest = {
  readonly input: ScannerInput
  readonly options: ScannerProcessOptions
  readonly requestId: number
  readonly type: 'process'
}

export type ScannerWorkerResponse =
  | {
      readonly requestId: number
      readonly stage: ScannerWorkerStage
      readonly type: 'stage'
    }
  | {
      readonly requestId: number
      readonly result: ScannerProcessResult
      readonly type: 'success'
    }
  | {
      readonly error: string
      readonly requestId: number
      readonly type: 'error'
    }

export type BrowserMemorySnapshot = {
  readonly bytes: number | null
  readonly method:
    | 'measureUserAgentSpecificMemory'
    | 'performance.memory'
    | 'unavailable'
}

export type BrowserCapabilities = {
  readonly createImageBitmap: boolean
  readonly crossOriginIsolated: boolean
  readonly offscreenCanvas: boolean
  readonly performanceMemory: boolean
  readonly userAgentSpecificMemory: boolean
  readonly wasm: boolean
  readonly worker: boolean
}

export type ImageScannerSpikeReport = {
  readonly accuracy: {
    readonly cornerMeanErrorPx: number
    readonly cornerMeanErrorRatio: number
  }
  readonly capabilities: BrowserCapabilities
  readonly cancellation: {
    readonly cancelled: boolean
    readonly latencyMs: number
    readonly recoverySucceeded: boolean
    readonly stageReached: ScannerWorkerStage | null
  }
  readonly generatedAt: string
  readonly memory: {
    readonly before: BrowserMemorySnapshot
    readonly afterFirstRun: BrowserMemorySnapshot
    readonly afterRepeatedRuns: BrowserMemorySnapshot
    readonly afterWorkerTermination: BrowserMemorySnapshot
    readonly firstRunDeltaBytes: number | null
    readonly repeatedRunsDeltaBytes: number | null
    readonly retainedAfterTerminationBytes: number | null
    readonly repeatedWasmHeapBytes: readonly (number | null)[]
  }
  readonly normalRun: Omit<ScannerProcessResult, 'output'>
  readonly passed: boolean
  readonly repeatedRunDurationsMs: readonly number[]
  readonly userAgent: string
}
