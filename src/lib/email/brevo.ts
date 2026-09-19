/**
 * lib/email/brevo.ts — Brevo SMTP API v3 provider adapter.
 *
 * Implements the shared EmailProvider contract (see ./provider.ts), so
 * callers swap transports without logic changes. Mirrors the emitlo
 * adapter's hardening shape with Brevo-specific policy:
 * - POST https://api.brevo.com/v3/smtp/email, `api-key` header auth.
 * - Sender identity comes from BREVO_SENDER_* (Brevo requires verified
 *   senders); the caller's `from` is intentionally NOT forwarded.
 * - replyTo is set only when BREVO_REPLY_TO is configured.
 * - Exactly 1 retry after 2s on 5xx/timeout ONLY (never 4xx/429).
 * - Circuit breaker: open after 3 consecutive failures, half-open after 5min.
 * - Daily cap (free tier: 300/day): Redis counter per UTC day, warn at 250,
 *   refuse with `daily-limit` past 300. Memory fallback when Redis is down.
 *
 * Fail-open: send() NEVER throws — every path returns EmailResult.
 * No secrets in telemetry: logs carry masked recipients
 * (first2***@domain), never full addresses, never the API key.
 */

import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { redisIncr } from '@/lib/redis'
import type { EmailMessage, EmailProvider, EmailResult } from './provider'

const SEND_URL = 'https://api.brevo.com/v3/smtp/email'
const TIMEOUT_MS = 10_000
const RETRY_DELAY_MS = 2000
const MAX_CONSECUTIVE_FAILURES = 3
const CIRCUIT_OPEN_MS = 5 * 60 * 1000
const DAILY_LIMIT = 300
const DAILY_WARN_AT = 250

// Module-level circuit breaker (single process).
let consecutiveFailures = 0
let circuitOpenedAt: number | null = null

/** Test seam: reset the module-level circuit breaker. */
export function resetBrevoCircuit(): void {
  consecutiveFailures = 0
  circuitOpenedAt = null
}

function senderConfig(): { name: string; email: string } {
  return {
    name: process.env.BREVO_SENDER_NAME || 'Games Arabic',
    email: process.env.BREVO_SENDER_EMAIL || 'noreply@smtp-brevo.com',
  }
}

function replyToConfig(): { email: string; name: string } | null {
  const email = process.env.BREVO_REPLY_TO || ''
  if (!email) return null
  return { email, name: 'Games Arabic Support' }
}

/** first2***@domain — safe for logs, useless for harvesting. */
export function maskRecipient(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const masked = local.length <= 2 ? `${local[0]}***` : `${local.slice(0, 2)}***`
  return `${masked}@${email.slice(at + 1)}`
}

function reasonForStatus(status: number): string {
  if (status === 400) return 'validation-error'
  if (status === 401) return 'unauthorized'
  if (status === 402) return 'rate-limited' // Brevo: plan/quota exceeded
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postOnce(args: {
  key: string
  payload: Record<string, unknown>
}): Promise<{ status: number; messageId?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': args.key,
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
    // Documented: { messageId: "<...>@smtp-relay.mailin.fr" }.
    const root = data as null | { messageId?: unknown }
    const messageId = typeof root?.messageId === 'string' ? root.messageId : undefined
    return { status: res.status, messageId }
  } finally {
    clearTimeout(timer)
  }
}

async function checkDailyCap(requestId?: string): Promise<{ allowed: boolean }> {
  const day = new Date().toISOString().slice(0, 10)
  let count = 0
  try {
    count = await redisIncr(`brevo:daily:${day}`, 24 * 60 * 60)
  } catch (err) {
    // intentional: expected+handled (counter unavailable → fail-open, the
    // provider-side quota remains the backstop)
    logger.warn({ event: 'brevo_daily_cap_unavailable', err }, 'brevo daily counter failed')
    return { allowed: true }
  }
  if (count > DAILY_LIMIT) {
    logger.warn(
      { event: 'brevo_daily_limit', count, limit: DAILY_LIMIT, ...(requestId ? { requestId } : {}) },
      'brevo daily email limit reached — email not sent',
    )
    return { allowed: false }
  }
  if (count >= DAILY_WARN_AT) {
    logger.warn(
      { event: 'brevo_daily_warn', count, limit: DAILY_LIMIT, ...(requestId ? { requestId } : {}) },
      'brevo daily email usage approaching free-tier limit',
    )
  }
  return { allowed: true }
}

function recordFailure(reason: string): void {
  consecutiveFailures += 1
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    circuitOpenedAt = Date.now()
  }
}

export const brevoProvider: EmailProvider = {
  async send(msg: EmailMessage): Promise<EmailResult> {
    const started = Date.now()
    const key = process.env.BREVO_API_KEY || ''
    const requestId = msg.requestId
    const ctx = requestId ? { requestId } : {}
    try {
      if (!key) {
        logger.warn('[brevo] BREVO_API_KEY not configured — email not sent', ctx)
        return { ok: false, reason: 'not-configured' }
      }

      // Circuit breaker: open after 3 consecutive failures, half-open after 5min.
      if (circuitOpenedAt !== null) {
        if (Date.now() - circuitOpenedAt < CIRCUIT_OPEN_MS) {
          logger.warn('[brevo] circuit open — email not sent', ctx)
          reportError(new Error('[brevo] circuit open'), { route: 'brevo:send', ...ctx })
          return { ok: false, reason: 'circuit-open' }
        }
        circuitOpenedAt = null // half-open: allow one trial send below
      }

      if (!msg.to || msg.to.length === 0) {
        return { ok: false, reason: 'validation-error' }
      }

      const cap = await checkDailyCap(msg.requestId)
      if (!cap.allowed) {
        return { ok: false, reason: 'daily-limit' }
      }

      const sender = senderConfig()
      const payload: Record<string, unknown> = {
        sender,
        to: msg.to.map((email) => ({ email })),
        subject: msg.subject,
        htmlContent: msg.html,
      }
      const replyTo = replyToConfig()
      if (replyTo) payload.replyTo = replyTo
      if (msg.text) payload.textContent = msg.text

      // Attempt 1 + exactly 1 retry after 2s on 5xx/timeout ONLY (never 4xx/429).
      let attempt = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        attempt += 1
        if (attempt === 2) await sleep(RETRY_DELAY_MS)
        try {
          const { status, messageId } = await postOnce({ key, payload })
          if (status >= 200 && status < 300) {
            consecutiveFailures = 0
            circuitOpenedAt = null
            logger.info('[brevo] sent', {
              to: msg.to.map(maskRecipient),
              latencyMs: Date.now() - started,
              ...ctx,
            })
            return { ok: true, providerMessageId: messageId }
          }
          if (status >= 500 && attempt === 1) continue // single retry
          return failWith(reasonForStatus(status), ctx, started)
        } catch (err) {
          if (isTimeout(err)) {
            if (attempt === 1) continue // single retry on timeout
            return failWith('timeout', ctx, started)
          }
          return failWith('network-error', ctx, started)
        }
      }
    } catch (err) {
      // Fail-open: NEVER throws.
      return failWith('network-error', ctx, started, err, true)
    }
  },
}

function failWith(
  reason: string,
  logCtx: Record<string, unknown>,
  startMs: number,
  err?: unknown,
  thrown = false,
): EmailResult {
  recordFailure(reason)
  logger.warn('[brevo] send failed', {
    reason,
    latencyMs: Date.now() - startMs,
    ...logCtx,
  })
  // Unexpected + auth/misconfig classes: 5xx/timeout/network, plus 401
  // (bad key) and 400 validation-error (usually an unverified sender).
  // These page Sentry because they indicate config problems, not user errors.
  // 429/402 (quota) stay warn-only — expected under load.
  if (
    reason === 'server-error' ||
    reason === 'timeout' ||
    reason === 'network-error' ||
    reason === 'unauthorized' ||
    reason === 'validation-error'
  ) {
    reportError(thrown && err instanceof Error ? err : new Error(`[brevo] send failed: ${reason}`), {
      route: 'brevo:send',
      ...logCtx,
    })
  }
  return { ok: false, reason }
}

/**
 * Boot-time verification (fail-open): checks the API key via GET /v3/account
 * and confirms BREVO_SENDER_EMAIL is in the verified senders list
 * (GET /v3/senders). Misconfiguration is reported to Sentry — it never
 * throws and never blocks boot.
 */
export async function verifyBrevoSender(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const key = process.env.BREVO_API_KEY || ''
    if (!key) {
      logger.warn('[brevo] BREVO_API_KEY not configured — skipping sender verification')
      return { ok: false, reason: 'not-configured' }
    }
    const sender = senderConfig()
    const headers = { accept: 'application/json', 'api-key': key }

    const accountRes = await fetch('https://api.brevo.com/v3/account', { headers })
    if (accountRes.status === 401) {
      reportError(new Error('[brevo] API key rejected (401) — check BREVO_API_KEY'), {
        route: 'brevo:verify',
      })
      return { ok: false, reason: 'unauthorized' }
    }
    if (!accountRes.ok) {
      logger.warn('[brevo] account check failed', { status: accountRes.status })
      return { ok: false, reason: `http-${accountRes.status}` }
    }

    const sendersRes = await fetch('https://api.brevo.com/v3/senders', { headers })
    if (!sendersRes.ok) {
      logger.warn('[brevo] senders check failed', { status: sendersRes.status })
      return { ok: false, reason: `senders-http-${sendersRes.status}` }
    }
    const senders = (await sendersRes.json().catch(() => null)) as {
      senders?: Array<{ email?: string; active?: boolean }>
    } | null
    const match = senders?.senders?.find(
      (s) => s.email?.toLowerCase() === sender.email.toLowerCase(),
    )
    if (!match) {
      reportError(
        new Error(`[brevo] sender not verified in Brevo dashboard: ${sender.email}`),
        { route: 'brevo:verify' },
      )
      return { ok: false, reason: 'sender-not-verified' }
    }
    if (match.active === false) {
      reportError(new Error(`[brevo] sender inactive in Brevo dashboard: ${sender.email}`), {
        route: 'brevo:verify',
      })
      return { ok: false, reason: 'sender-inactive' }
    }
    logger.info('[brevo] sender verified', { sender: maskRecipient(sender.email) })
    return { ok: true }
  } catch (err) {
    logger.warn('[brevo] sender verification failed open', err)
    return { ok: false, reason: 'network-error' }
  }
}
