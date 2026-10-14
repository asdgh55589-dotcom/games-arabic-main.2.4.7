'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface UseFetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Fetch JSON from a URL with cancellation, refetch support, and stale-response protection.
 *
 * Pass `null` as the URL to skip fetching (useful for conditional fetches).
 * The `deps` array is appended to the effect's dependency list so callers can
 * trigger refetches by changing values in `deps` without changing the URL string itself.
 *
 * NOTE: We intentionally call setState during the effect's body for the
 * "url changed" case. The React rule of thumb says "avoid setState in effects",
 * but for a data-fetching hook this is the canonical pattern — the alternative
 * (derived state) doesn't work because we need to fire a network request, not
 * just recompute a value. ESLint's `react-hooks/set-state-in-effect` rule
 * catches this case but it's a false positive for fetch hooks.
 */
/**
 * Delay before a loading spinner/skeleton appears (ms). Fetches faster than
 * this never flash a skeleton — kills the <100ms spinner flicker.
 */
const SKELETON_DELAY_MS = 200

export interface UseFetchOptions {
  /**
   * Opt-in stale-while-revalidate window (ms) for this URL.
   * When set: a fresh cache entry is served instantly (no loading flash)
   * and revalidated in the background; failures keep serving the stale
   * entry. Disabled by default (0) — existing callers are unaffected.
   */
  staleMs?: number
}

interface CacheEntry {
  data: unknown
  at: number
}

/** Module-level response cache (per-URL). Cleared via `clearFetchCache`. */
const fetchCache = new Map<string, CacheEntry>()

function readCache(url: string, staleMs: number): unknown | undefined {
  if (staleMs <= 0) return undefined
  const entry = fetchCache.get(url)
  if (!entry || Date.now() - entry.at >= staleMs) return undefined
  return entry.data
}

/** Test seam + manual invalidation for the `useFetch` response cache. */
export function clearFetchCache(url?: string): void {
  if (url) fetchCache.delete(url)
  else fetchCache.clear()
}

export function useFetch<T>(
  url: string | null,
  deps: ReadonlyArray<unknown> = [],
  opts: UseFetchOptions = {},
) {
  const staleMs = opts.staleMs ?? 0
  const [state, setState] = useState<UseFetchState<T>>(() => {
    if (!url) return { data: null, loading: false, error: null }
    // Seed remounts from a fresh cache entry — no skeleton flash.
    const cached = readCache(url, staleMs)
    if (cached !== undefined) return { data: cached as T, loading: false, error: null }
    return { data: null, loading: true, error: null }
  })
  const [showSkeleton, setShowSkeleton] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url

  const runFetch = useCallback(
    async (background: boolean) => {
      const currentUrl = urlRef.current
      if (!currentUrl) {
        setState({ data: null, loading: false, error: null })
        return
      }
      if (!background) {
        // Serve a fresh cache entry instantly, then revalidate silently.
        const cached = readCache(currentUrl, staleMs)
        if (cached !== undefined) {
          setState({ data: cached as T, loading: false, error: null })
          void runFetch(true)
          return
        }
      }
      // Abort any in-flight request from a previous render
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (!background) {
        setState((prev) => ({ data: prev.data, loading: true, error: null }))
      }

      try {
        const res = await fetch(currentUrl, { signal: controller.signal })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as T
        if (controller.signal.aborted) return
        if (staleMs > 0) {
          fetchCache.set(currentUrl, { data: json, at: Date.now() })
        }
        setState({ data: json, loading: false, error: null })
      } catch (err: unknown) {
        if (controller.signal.aborted) return // swallow aborts
        const message = err instanceof Error ? err.message : 'Unknown error'
        // Preserve previously-loaded (stale) data so the UI can keep
        // rendering cached content alongside the error state + retry.
        setState((prev) => ({ data: prev.data, loading: false, error: message }))
      }
    },
    [staleMs],
  )

  const fetchData = useCallback(async () => {
    await runFetch(false)
  }, [runFetch])

  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [url, ...deps])

  // Delayed skeleton: only advertise loading UI when the fetch outlives the
  // delay. `loading` semantics are unchanged for existing callers.
  useEffect(() => {
    if (!state.loading) {
      setShowSkeleton(false)
      return
    }
    const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state.loading])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { ...state, showSkeleton, refetch }
}
