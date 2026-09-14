import * as Sentry from '@sentry/nextjs'

/**
 * Fail-open server-side error reporting (Sentry only — no Rollbar).
 *
 * - Never throws: every path is guarded so a telemetry failure can never
 *   break a request handler.
 * - No-op when no DSN is configured (returns 'skipped').
 * - Never sends secrets: only route/requestId/locale tags plus a masked
 *   user id (first4…last2). Raw ids, emails, tokens are never attached.
 */

export interface ReportContext {
  route?: string
  userId?: string
  requestId?: string
  locale?: string
  action?: string
}

const DEDUP_WINDOW_MS = 60_000
const DEDUP_MAX_ENTRIES = 500

// key: `${route}::${message}` → first-seen timestamp. Count only (no payloads).
const seen = new Map<string, number>()

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name || 'Error'
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err) ?? 'unknown error'
  } catch {
    return 'unknown error'
  }
}

/** Mask a user id as first4…last2 so Sentry never stores the raw id. */
export function maskId(userId: string | null | undefined): string {
  if (!userId) return ''
  const id = String(userId)
  if (id.length <= 6) return '***'
  return `${id.slice(0, 4)}…${id.slice(-2)}`
}

/** Test seam: reset the in-memory dedup window. */
export function clearDedup(): void {
  seen.clear()
}

function prune(now: number): void {
  for (const [key, ts] of seen) {
    if (now - ts > DEDUP_WINDOW_MS) seen.delete(key)
  }
  while (seen.size > DEDUP_MAX_ENTRIES) {
    const oldest = seen.keys().next()
    if (oldest.done) break
    seen.delete(oldest.value)
  }
}

/**
 * Report a server-side error to Sentry. Fail-open: always returns a status
 * string and never throws.
 *
 * Returns 'skipped' (no DSN), 'deduped' (same message+route within 60s),
 * 'error' (telemetry itself failed), or the Sentry event id.
 */
export function reportError(err: unknown, ctx: ReportContext = {}): string {
  try {
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
      return 'skipped'
    }
    const route = ctx.route ?? 'unknown'
    const key = `${route}::${messageOf(err)}`
    const now = Date.now()
    const firstSeen = seen.get(key)
    if (firstSeen !== undefined && now - firstSeen < DEDUP_WINDOW_MS) {
      return 'deduped'
    }
    seen.set(key, now)
    prune(now)

    const tags: Record<string, string> = { route }
    if (ctx.requestId) tags['requestId'] = ctx.requestId
    if (ctx.locale) tags['locale'] = ctx.locale

    return Sentry.captureException(err, {
      tags,
      ...(ctx.userId ? { user: { id: maskId(ctx.userId) } } : {}),
      extra: {
        route,
        ...(ctx.action ? { action: ctx.action } : {}),
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        ...(ctx.locale ? { locale: ctx.locale } : {}),
      },
    })
  } catch {
    return 'error'
  }
}
