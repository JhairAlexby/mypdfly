import { useCallback, useSyncExternalStore } from 'react'

import type {
  CompressionJob,
  CompressionJobState,
} from '@/features/file-compression/core'

export const useCompressionJobState = (
  job: CompressionJob,
): CompressionJobState => {
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      job.subscribe(onStoreChange, false),
    [job],
  )
  const getSnapshot = useCallback(() => job.state, [job])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
