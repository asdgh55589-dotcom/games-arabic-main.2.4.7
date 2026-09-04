// Updated for new API response format
/**
 * Wrapper around `fetch` that:
 *  - Throws on non-2xx responses (so callers can use try/catch)
 *  - Returns parsed JSON typed as `T`
 *  - Includes the server-provided error message when available
 *
 * Use this for all mutation/fetch calls from the client where you need to
 * distinguish success from failure. For data-fetching via `useFetch`, the
 * hook already handles non-ok responses internally.
 */
export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: unknown }
      }
      if (body?.error?.message) message = body.error.message
    } catch {
      // Response body wasn't JSON — keep the default HTTP message
    }
    throw new ApiError(message, res.status)
  }
  return (await res.json()) as T
}

/** Error with an attached HTTP status code, for finer-grained handling. */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
