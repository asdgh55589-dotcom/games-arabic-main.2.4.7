import { reportError } from '@/lib/error-reporting'

/**
 * reportedFetch — thin `fetch` wrapper with opt-in error reporting.
 *
 * Reports ONLY on failure:
 *  - network error (fetch rejects), or
 *  - response with status >= 500.
 * Success paths and response shapes are untouched: the original Response
 * is returned as-is, and network errors are rethrown unchanged.
 *
 * `src/lib/http.ts` is an ofetch instance (not a raw fetch wrapper), so the
 * reporting wrapper lives here instead of modifying shared success paths.
 */
export async function reportedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { action?: string },
): Promise<Response> {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url

  let pathname: string | undefined
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'http://localhost'
    pathname = new URL(rawUrl, base).pathname
  } catch {
    pathname = undefined
  }

  const fallbackMethod =
    typeof input !== 'string' && !(input instanceof URL)
      ? (input as Request).method
      : undefined
  const method = init?.method ?? fallbackMethod ?? 'GET'
  const action = opts?.action ?? method

  try {
    const res = await fetch(input, init)
    if (res.status >= 500) {
      try {
        reportError(new Error(`HTTP ${res.status} ${pathname ?? rawUrl}`), {
          route: pathname,
          action,
        })
      } catch {
        // fail-open
      }
    }
    return res
  } catch (err) {
    try {
      reportError(err, { route: pathname, action })
    } catch {
      // fail-open
    }
    throw err
  }
}
