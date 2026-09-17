/**
 * Client-side reader for YouTube metadata API errors (P1).
 *
 * The API returns `{ error: { code, message, details } }`:
 * - classified yt-dlp failures carry the Arabic sentence in `message`
 * - 422 validation failures carry the generic envelope message
 *   ("Invalid input") with the specific Arabic text inside `details`
 * This helper prefers the specific message in both cases.
 */
export function extractVideoErrorMessage(payload: unknown): string | null {
  const err = (payload as { error?: unknown } | null | undefined)?.error
  if (!err) return null
  if (typeof err === 'string') return err
  if (typeof err !== 'object') return null
  const { code, message, details } = err as {
    code?: string
    message?: string
    details?: unknown
  }
  if (code === 'VALIDATION_ERROR' && details) {
    if (typeof details === 'string' && details) return details
    if (typeof details === 'object') {
      const flat = Object.values(details as Record<string, unknown>).flat()
      const first = flat.find((v) => typeof v === 'string' && v)
      if (typeof first === 'string') return first
    }
  }
  return typeof message === 'string' && message ? message : null
}
