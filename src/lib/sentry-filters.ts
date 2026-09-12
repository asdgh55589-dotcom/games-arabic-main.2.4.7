import type { ErrorEvent, EventHint } from '@sentry/nextjs'

/**
 * Shared Sentry event filters (imported by sentry.server.config.ts).
 *
 * Kept in a plain module (no Sentry.init side effects) so unit tests can
 * import `sentryBeforeSend` directly.
 */

const DROP_STATUSES = new Set([401, 403, 404])

// Quota / rate-limit markers. Envelope codes live in src/lib/api-response.ts
// (RATE_LIMITED, line ~90-91) and the 429 JSON envelope in
// src/lib/rate-limit.ts (line ~80-81); Arabic quota-deny reasons live in
// src/lib/quota.ts (lines ~112-127).
const QUOTA_MARKERS = [
  'QUOTA',
  'RATE_LIMIT',
  'RATE_LIMITED',
  'quota',
  'تجاوزت',
  'يتجاوز الحد الأقصى',
  'الحصة',
]

// Bare status code needs a word boundary (a plain '429' substring would also
// match counts/durations inside event text).
const RATE_LIMIT_CODE_RE = /\b429\b/

function readStatus(event: ErrorEvent): number | null {
  const contexts = (event as { contexts?: Record<string, unknown> }).contexts
  const response = contexts?.['response'] as { status_code?: unknown } | undefined
  if (typeof response?.status_code === 'number') return response.status_code
  const tags = (event as { tags?: Record<string, unknown> }).tags
  const tagged = tags?.['status_code'] ?? tags?.['status']
  if (typeof tagged === 'number') return tagged
  if (typeof tagged === 'string' && /^\d{3}$/.test(tagged)) return Number(tagged)
  return null
}

function eventText(event: ErrorEvent, hint?: EventHint): string {
  const parts: string[] = []
  const values = event.exception?.values
  if (Array.isArray(values)) {
    for (const v of values) {
      if (v?.type) parts.push(String(v.type))
      if (v?.value) parts.push(String(v.value))
    }
  }
  if (typeof event.message === 'string') parts.push(event.message)
  const original = (hint as { originalException?: unknown } | undefined)?.originalException
  if (original instanceof Error) {
    parts.push(original.name)
    parts.push(original.message)
  } else if (typeof original === 'string') {
    parts.push(original)
  }
  return parts.join('\n')
}

/**
 * beforeSend for the Node.js server runtime.
 * Returns null (drop) for noisy/expected envelopes, otherwise the event.
 */
export function sentryBeforeSend(
  event: ErrorEvent,
  hint?: EventHint,
): ErrorEvent | null {
  const text = eventText(event, hint)
  const status = readStatus(event)

  // 1. Auth/not-found responses — expected control flow, not bugs.
  // Matches fail() envelopes in src/lib/api-response.ts:77 (NOT_FOUND/404),
  // :80 (UNAUTHORIZED/401), :83 (FORBIDDEN/403).
  if (status !== null && DROP_STATUSES.has(status)) return null
  if (/\b(401|403|404)\b/.test(text) && /\b(unauthorized|forbidden|not found|UNAUTHORIZED|FORBIDDEN|NOT_FOUND)\b/i.test(text)) {
    return null
  }

  // 2. ZodError / validation failures — client input errors, not server bugs.
  // Matches validationFail() envelope in src/lib/api-response.ts:86-87
  // (VALIDATION_ERROR / 'Invalid input').
  if (/zoderror/i.test(text)) return null
  if (/VALIDATION_ERROR/.test(text)) return null
  if (/^invalid input\b/im.test(text)) return null

  // 3. Quota-denied / rate-limited — expected backpressure, not bugs.
  // Matches rateLimited() envelope in src/lib/api-response.ts:90-91
  // (RATE_LIMITED/429), the 429 envelope in src/lib/rate-limit.ts:80-81,
  // and Arabic quota reasons in src/lib/quota.ts:112-127.
  if (status === 429) return null
  if (RATE_LIMIT_CODE_RE.test(text)) return null
  for (const marker of QUOTA_MARKERS) {
    if (text.includes(marker)) return null
  }

  // 4. Aborted uploads — client disconnected mid-stream, not a server bug.
  // Matches abort paths such as the SSE abort listener in
  // src/app/api/notifications/stream/route.ts:54 and aborted req.arrayBuffer()
  // reads in upload routes.
  if (/aborterror/i.test(text)) return null
  if (/\b aborted\b/i.test(text) && /upload/i.test(text)) return null

  return event
}
