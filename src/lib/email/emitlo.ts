/**
 * lib/email/emitlo.ts — Emitlo REST provider adapter (SA-1).
 *
 * DOCS vs ASSUMPTIONS (staging-verify):
 * - Docs (https://docs.emitlo.com/api/send-email/, fetched 2026-09-12):
 *   POST https://api.emitlo.com/api/v1/messages,
 *   Authorization: Bearer <key>,
 *   JSON { from_email, from_name?, to_email, to_name?, subject, body,
 *   reply_to?, attachments? } → HTTP 202 { status: "success",
 *   data: { message_id } }. Error envelope { status: "error",
 *   error: { code, message } } with 401 UNAUTHENTICATED / 403 FORBIDDEN /
 *   404 / 409 / 422 VALIDATION_ERROR (+ATTACHMENT_TOO_LARGE,
 *   MESSAGE_TOO_LARGE) / 429 RATE_LIMITED (+Retry-After) / 500
 *   INTERNAL_ERROR.
 * - Task fallback assumed POST {EMITLO_API_URL}/send with
 *   { from, to[], subject, html, text }. That shape was NOT used: the real
 *   docs above govern. EMITLO_API_URL therefore defaults to the documented
 *   host 'https://api.emitlo.com' and the documented path
 *   '/api/v1/messages' is appended.
 * - STAGING-VERIFY: (1) multi-recipient sends are fanned out as sequential
 *   single-recipient POSTs (a batch endpoint exists in docs but is out of
 *   scope); (2) Emitlo documents only an HTML `body` field, so `text` is
 *   used as the body ONLY when `html` is empty, otherwise dropped;
 *   (3) a `from` value shaped 'Name <addr>' is split into from_name /
 *   from_email, otherwise from_name is omitted; (4) success parsing accepts
 *   both the documented data.message_id and legacy { id } shapes;
 *   (5) 429 is NOT retried per spec (fail-open single attempt + retry);
 *   docs recommend honoring Retry-After — caller-level backoff is deferred
 *   to staging.
 *
 * Fail-open: send() NEVER throws — every path returns EmailResult.
 * No secrets in telemetry: logs carry only a masked key (first4…last2),
 * status, latencyMs; bodies/recipients/subjects are never logged and the
 * full key is never passed to logger/reportError.
 */

import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import type { EmailMessage, EmailProvider, EmailResult } from './provider'

const DEFAULT_BASE_URL = 'https://api.emitlo.com'
const SEND_PATH = '/api/v1/messages'
const TIMEOUT_MS_DEFAULT = 10_000
const MAX_CONSECUTIVE_FAILURES = 5
const CIRCUIT_OPEN_MS = 60_000

// Module-level circuit breaker (single process).
let consecutiveFailures = 0
let circuitOpenedAt: number | null = null

/** Test seam: reset the module-level circuit breaker. */
export function resetEmitloCircuit(): void {
  consecutiveFailures = 0
  circuitOpenedAt = null
}

function maskKey(key: string): string {
  if (!key || key.length <= 6) return '***'
  return `${key.slice(0, 4)}…${key.slice(-2)}`
}

function timeoutMs(): number {
  const raw = Number(process.env.EMITLO_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : TIMEOUT_MS_DEFAULT
}

function sendUrl(): string {
  const base = (process.env.EMITLO_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '')
  return `${base}${SEND_PATH}`
}

function splitFrom(from: string): { from_email: string; from_name?: string } {
  const m = from.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/)
  if (m) {
    const name = (m[1] || '').trim().replace(/^["']|["']$/g, '')
    return name ? { from_email: m[2], from_name: name } : { from_email: m[2] }
  }
  return { from_email: from }
}

function reasonForStatus(status: number): string {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not-found'
  if (status === 422) return 'validation-error'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'server-error'
  return `http-${status}`
}

function isTimeout(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof err === 'object' &&
      err !== null &&
      (err as { code?: unknown }).code === 'ABORT_ERR')
  )
}

async function postOnce(args: {
  url: string
  key: string
  payload: Record<string, unknown>
  ms: number
}): Promise<{ status: number; messageId?: string; errorCode?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), args.ms)
  try {
    const res = await fetch(args.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.payload),
      signal: controller.signal,
    })
    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    // Documented: { status: "success", data: { message_id } }.
    // Defensive: also accept { id } / { data: { id } } shapes.
    const root = data as null | {
      data?: { message_id?: unknown; id?: unknown }
      message_id?: unknown
      id?: unknown
      error?: { code?: unknown }
    }
    const messageId =
      (typeof root?.data?.message_id === 'string' && root.data.message_id) ||
      (typeof root?.data?.id === 'string' && root.data.id) ||
      (typeof root?.message_id === 'string' && root.message_id) ||
      (typeof root?.id === 'string' && root.id) ||
      undefined
    const errorCode =
      typeof root?.error?.code === 'string' ? (root.error.code as string) : undefined
    return { status: res.status, messageId, errorCode }
  } finally {
    clearTimeout(timer)
  }
}

async function sendToOneRecipient(args: {
  url: string
  key: string
  from: string
  to: string
  subject: string
  html: string
  text?: string
  ms: number
}): Promise<EmailResult> {
  const { from_email, from_name } = splitFrom(args.from)
  const payload: Record<string, unknown> = {
    from_email,
    to_email: args.to,
    subject: args.subject,
    // Emitlo documents a single HTML `body` field — no text part.
    body: args.html || args.text || '',
  }
  if (from_name) payload.from_name = from_name

  // Attempt 1 + exactly 1 retry on 5xx/timeout ONLY (never 4xx).
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1
    try {
      const { status, messageId } = await postOnce({
        url: args.url,
        key: args.key,
        payload,
        ms: args.ms,
      })
      if (status >= 200 && status < 300) {
        return { ok: true, providerMessageId: messageId }
      }
      if (status >= 500 && attempt === 1) continue // single retry
      return { ok: false, reason: reasonForStatus(status) }
    } catch (err) {
      if (isTimeout(err)) {
        if (attempt === 1) continue // single retry on timeout
        return { ok: false, reason: 'timeout' }
      }
      return { ok: false, reason: 'network-error' }
    }
  }
}

export const emitloProvider: EmailProvider = {
  async send(msg: EmailMessage): Promise<EmailResult> {
    const started = Date.now()
    const key = process.env.EMITLO_API_KEY || ''
    const requestId = msg.requestId
    try {
      if (!key) {
        logger.warn('[emitlo] EMITLO_API_KEY not configured — email not sent', {
          ...(requestId ? { requestId } : {}),
        })
        return { ok: false, reason: 'not-configured' }
      }

      // Circuit breaker: open after 5 consecutive failures, half-open after 60s.
      if (circuitOpenedAt !== null) {
        if (Date.now() - circuitOpenedAt < CIRCUIT_OPEN_MS) {
          logger.warn('[emitlo] circuit open — email not sent', {
            key: maskKey(key),
            ...(requestId ? { requestId } : {}),
          })
          reportError(new Error('[emitlo] circuit open'), {
            route: 'emitlo:send',
            ...(requestId ? { requestId } : {}),
          })
          return { ok: false, reason: 'circuit-open' }
        }
        circuitOpenedAt = null // half-open: allow one trial send below
      }

      if (!msg.to || msg.to.length === 0) {
        return { ok: false, reason: 'validation-error' }
      }

      const url = sendUrl()
      const ms = timeoutMs()
      let firstId: string | undefined
      for (const recipient of msg.to) {
        const result = await sendToOneRecipient({
          url,
          key,
          from: msg.from,
          to: recipient,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          ms,
        })
        if (!result.ok) {
          consecutiveFailures += 1
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            circuitOpenedAt = Date.now()
          }
          const latencyMs = Date.now() - started
          logger.warn('[emitlo] send failed', {
            key: maskKey(key),
            status: result.reason,
            latencyMs,
            ...(requestId ? { requestId } : {}),
          })
          // Unexpected classes only: 5xx/timeout/network — never 4xx/missing-key.
          if (
            result.reason === 'server-error' ||
            result.reason === 'timeout' ||
            result.reason === 'network-error'
          ) {
            reportError(new Error(`[emitlo] send failed: ${result.reason}`), {
              route: 'emitlo:send',
              ...(requestId ? { requestId } : {}),
            })
          }
          return result
        }
        if (!firstId && result.providerMessageId) firstId = result.providerMessageId
      }

      consecutiveFailures = 0
      circuitOpenedAt = null
      logger.info('[emitlo] sent', {
        key: maskKey(key),
        status: 'accepted',
        latencyMs: Date.now() - started,
        ...(requestId ? { requestId } : {}),
      })
      return { ok: true, providerMessageId: firstId }
    } catch (err) {
      // Fail-open: NEVER throws.
      consecutiveFailures += 1
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        circuitOpenedAt = Date.now()
      }
      logger.warn('[emitlo] send threw', {
        key: maskKey(key),
        status: 'exception',
        latencyMs: Date.now() - started,
        ...(requestId ? { requestId } : {}),
      })
      reportError(err, {
        route: 'emitlo:send',
        ...(requestId ? { requestId } : {}),
      })
      return { ok: false, reason: 'network-error' }
    }
  },
}
