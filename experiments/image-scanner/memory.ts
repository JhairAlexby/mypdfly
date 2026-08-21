import type {
  BrowserCapabilities,
  BrowserMemorySnapshot,
} from './types'

type PerformanceMemory = {
  readonly usedJSHeapSize: number
}

type UserAgentSpecificMemoryResult = {
  readonly bytes: number
}

type PerformanceWithMemory = Performance & {
  readonly memory?: PerformanceMemory
  readonly measureUserAgentSpecificMemory?: () => Promise<UserAgentSpecificMemoryResult>
}

const getExtendedPerformance = () => performance as PerformanceWithMemory

export const getBrowserCapabilities = (): BrowserCapabilities => {
  const extendedPerformance = getExtendedPerformance()

  return {
    createImageBitmap: typeof createImageBitmap === 'function',
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    offscreenCanvas: typeof OffscreenCanvas === 'function',
    performanceMemory: typeof extendedPerformance.memory?.usedJSHeapSize === 'number',
    userAgentSpecificMemory:
      typeof extendedPerformance.measureUserAgentSpecificMemory === 'function',
    wasm: typeof WebAssembly === 'object',
    worker: typeof Worker === 'function',
  }
}

export const measureBrowserMemory = async (): Promise<BrowserMemorySnapshot> => {
  const extendedPerformance = getExtendedPerformance()

  if (extendedPerformance.measureUserAgentSpecificMemory) {
    try {
      const result = await extendedPerformance.measureUserAgentSpecificMemory()
      return {
        bytes: result.bytes,
        method: 'measureUserAgentSpecificMemory',
      }
    } catch {
      // Some Chromium builds expose the API but keep it disabled. Fall through.
    }
  }

  if (extendedPerformance.memory) {
    return {
      bytes: extendedPerformance.memory.usedJSHeapSize,
      method: 'performance.memory',
    }
  }

  return { bytes: null, method: 'unavailable' }
}
