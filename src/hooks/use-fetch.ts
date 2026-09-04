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
export function useFetch<T>(url: string | null, deps: ReadonlyArray<unknown> = []) {
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: !!url,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)
  const urlRef = useRef(url)
  urlRef.current = url

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current
    if (!currentUrl) {
      setState({ data: null, loading: false, error: null })
      return
    }
    // Abort any in-flight request from a previous render
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({ data: prev.data, loading: true, error: null }))

    try {
      const res = await fetch(currentUrl, { signal: controller.signal })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as T
      if (!controller.signal.aborted) {
        setState({ data: json, loading: false, error: null })
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return // swallow aborts
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ data: null, loading: false, error: message })
    }
  }, [])

  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
  }, [url, ...deps])

  const refetch = useCallback(() => {
    fetchData()
  }, [fetchData])

  return { ...state, refetch }
}
