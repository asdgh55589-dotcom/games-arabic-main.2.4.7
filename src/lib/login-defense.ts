/**
 * lib/login-defense.ts — audit D.2 login hardening primitives.
 *
 * - ONE generic Arabic credential error (no user-enumeration oracle).
 * - Progressive delay per IP+username: 0,1,2,4,8s (cap) — in-memory with
 *   TTL (same fallback style as lib/rate-limit.ts).
 * - Turnstile hook placeholder: required after 5 fails; without a
 *   configured secret it NEVER blocks (explicit placeholder contract).
 */

/** The ONLY credential-failure message the login route may return. */
export const LOGIN_GENERIC_ERROR = 'بيانات الدخول غير صحيحة'

const DELAYS = [0, 1, 2, 4, 8]

/** Seconds to wait before answering a failed attempt (cap 8s). */
export function loginDelayFor(failCount: number): number {
  if (failCount <= 0) return 0
  return DELAYS[Math.min(failCount, DELAYS.length - 1)]
}

interface FailEntry {
  count: number
  expiresAt: number
}

const FAIL_TTL_MS = 15 * 60 * 1000
const failures = new Map<string, FailEntry>()

function sweep(now = Date.now()): void {
  if (failures.size > 10000) {
    for (const [k, v] of failures) {
      if (v.expiresAt <= now) failures.delete(k)
    }
  }
}

export function failureKey(ip: string, username: string): string {
  return `${ip}::${(username || '').toLowerCase()}`
}

export function getLoginFailures(key: string): number {
  const e = failures.get(key)
  if (!e || e.expiresAt <= Date.now()) {
    failures.delete(key)
    return 0
  }
  return e.count
}

export function recordLoginFailure(key: string): number {
  sweep()
  const next = getLoginFailures(key) + 1
  failures.set(key, { count: next, expiresAt: Date.now() + FAIL_TTL_MS })
  return next
}

export function clearLoginFailures(key: string): void {
  failures.delete(key)
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
