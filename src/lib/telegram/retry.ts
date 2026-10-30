/**
 * lib/telegram/retry.ts — Retry helper with exponential backoff / Retry-After support.
 */

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 3
  const baseDelayMs = opts?.baseDelayMs ?? 1000

  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxRetries - 1) break

      const retryAfter = (err as { retryAfter?: unknown })?.retryAfter
      let delay: number
      if (typeof retryAfter === 'number' && Number.isFinite(retryAfter)) {
        delay = retryAfter * 1000
      } else {
        delay = baseDelayMs * 2 ** attempt
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
