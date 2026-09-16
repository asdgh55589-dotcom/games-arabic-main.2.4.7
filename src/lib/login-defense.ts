/**
 * lib/login-defense.ts — audit D.2 login hardening primitives.
 *
 * - ONE generic Arabic credential error (no user-enumeration oracle).
 * - Progressive delay per IP+username: 0,1,2,4,8s (cap).
 * - Failure counters live in the SHARED store (Redis via @/lib/redis,
 *   atomic INCR + TTL) — never in module memory — so they survive
 *   process restarts and are shared across instances. Key format:
 *   `auth:fail:<sha256 hex of "ip::identifier">` — composite (identifier +
 *   IP), so accounts are never locked by identifier alone (no lockout DoS).
 *   Per-IP abuse is additionally capped by lib/rate-limit (auth:login 5/min)
 *   and the Edge POST /api/auth gate (10/min).
 * - Turnstile hook placeholder: required after 5 fails; without a
 *   configured secret it NEVER blocks (explicit placeholder contract).
 */

import { createHash } from 'crypto'
import { redisDel, redisGet, redisIncr } from './redis'

/** The ONLY credential-failure message the login route may return. */
export const LOGIN_GENERIC_ERROR = 'بيانات الدخول غير صحيحة'

const DELAYS = [0, 1, 2, 4, 8]

/** Failure-counter window: 5 fails within 15 minutes trigger CAPTCHA. */
export const LOGIN_FAIL_TTL_SECONDS = 15 * 60

const STORE_KEY_PREFIX = 'auth:fail:'

/** Hash the readable failure key — raw IPs/usernames never touch the store. */
function storeKey(key: string): string {
  return `${STORE_KEY_PREFIX}${createHash('sha256').update(key).digest('hex')}`
}

/** Seconds to wait before answering a failed attempt (cap 8s). */
export function loginDelayFor(failCount: number): number {
  if (failCount <= 0) return 0
  return DELAYS[Math.min(failCount, DELAYS.length - 1)]
}

export function failureKey(ip: string, username: string): string {
  return `${(ip || '').trim()}::${(username || '').trim().toLowerCase()}`
}

/** Read the distributed failure count (0 when unverifiable — fail-open). */
export async function getLoginFailures(key: string): Promise<number> {
  try {
    const v = await redisGet<number>(storeKey(key))
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
  } catch {
    return 0
  }
}

/** Atomically increment the distributed failure count (returns new count). */
export async function recordLoginFailure(key: string): Promise<number> {
  try {
    const n = await redisIncr(storeKey(key), LOGIN_FAIL_TTL_SECONDS)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

/** Clear the distributed failure count (best-effort). */
export async function clearLoginFailures(key: string): Promise<void> {
  try {
    await redisDel(storeKey(key))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort clear — stale counter expires via TTL
  }
}

export const CAPTCHA_FAIL_THRESHOLD = 5

/** Turnstile required once failures reach the threshold. */
export function captchaRequired(failCount: number): boolean {
  return failCount >= CAPTCHA_FAIL_THRESHOLD
}

export interface CaptchaVerdict {
  ok: boolean
  /** true while Turnstile is unwired — explicit non-gate placeholder. */
  placeholder: boolean
}

/**
 * Turnstile hook PLACEHOLDER. Without TURNSTILE_SECRET_KEY it returns
 * {ok:true, placeholder:true} (never blocks). With a secret it verifies
 * against the siteverify API and fails closed on network/error.
 */
export async function verifyCaptchaToken(token: string, ip: string): Promise<CaptchaVerdict> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { ok: true, placeholder: true }
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean } | null
    return { ok: json?.success === true, placeholder: false }
  } catch {
    return { ok: false, placeholder: false }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
