import { useCallback, useEffect, useState } from 'react'
import { ApiError, getJson } from './client'

export interface ApiState<T> {
  /** The response for `url`, or while that loads, the last one shown, so charts hold their frame. */
  data: T | undefined
  error: ApiError | undefined
  /** True while the response for the current `url` is still on its way. */
  loading: boolean
  retry: () => void
}

// The dataset is fixed for the life of the server, so a response never goes stale while the
// page is open, and going back to an earlier selection is instant.
const cache = new Map<string, unknown>()

export function clearApiCache() {
  cache.clear()
}

export function useApi<T>(url: string | null): ApiState<T> {
  const [shown, setShown] = useState<T | undefined>(undefined)
  const [failure, setFailure] = useState<{ url: string; error: ApiError } | undefined>()
  const [attempt, setAttempt] = useState(0)
  // Bumped when a response lands in the cache, to re-render and read it.
  const [, setLoaded] = useState(0)

  const cached = url !== null ? (cache.get(url) as T | undefined) : undefined
  if (cached !== undefined && cached !== shown) setShown(cached)

  useEffect(() => {
    if (url === null || cache.has(url)) return
    const controller = new AbortController()
    getJson<T>(url, controller.signal).then(
      (data) => {
        cache.set(url, data)
        setLoaded((n) => n + 1)
      },
      (err: unknown) => {
        if (controller.signal.aborted) return
        setFailure({ url, error: err instanceof ApiError ? err : new ApiError(String(err), null) })
      },
    )
    return () => controller.abort()
  }, [url, attempt])

  const retry = useCallback(() => {
    setFailure(undefined)
    setAttempt((n) => n + 1)
  }, [])

  const error = failure && failure.url === url ? failure.error : undefined
  return {
    data: cached ?? shown,
    error,
    loading: url !== null && cached === undefined && error === undefined,
    retry,
  }
}
