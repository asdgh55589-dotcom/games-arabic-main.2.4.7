/**
 * lib/login-defense.ts — audit D.2 login hardening primitives (Phase 4A).
 *
 * - ONE generic Arabic credential error (no user-enumeration oracle).
 * - Progressive delay per IP+username: 0,1,2,4,8s (cap).
 * - HARD LOCKOUT: 10 failures within the 15-minute window locks the
 *   composite (IP+identifier) key for 15 minutes (429 ACCOUNT_LOCKED +
 *   Retry-After). Composite so accounts are never locked by identifier
 *   alone (no lockout DoS). Per-IP abuse is additionally capped by
 *   lib/rate-limit (auth:login 5/min) and the Edge POST /api/auth gate.
 * - Failure counters AND lockout markers live in the SHARED store (Redis
 *   via @/lib/redis, atomic INCR + TTL) — never in module memory — so they
 *   survive process restarts and are shared across instances. Key formats:
 *   `auth:fail:<sha256 hex of "ip::identifier">`,
 *   `auth:lock:<sha256 hex of "ip::identifier">` (expiry epoch-ms value).
 *   Raw IPs/usernames never touch the store.
 * - The old Turnstile/CAPTCHA placeholder gate was REMOVED (Phase 4A,
 *   Option B): no TURNSTILE keys exist in any environment, so the hook
 *   could never block. Lockout + rate limits + delays are the backstop.
 * - All store failures are fail-OPEN (fail-open to login attempt) — a
 *   degraded store must not lock every user out.
 */

import { createHash } from 'crypto'
import { redisDel, redisGet, redisIncr, redisSet } from './redis'

/** The ONLY credential-failure message the login route may return. */
export const LOGIN_GENERIC_ERROR = 'بيانات الدخول غير صحيحة'

/** Lockout response message (Arabic, includes the 15-minute wait). */
export const ACCOUNT_LOCKED_MESSAGE =
  'تم قفل الحساب مؤقتًا بسبب محاولات متعددة فاشلة. يرجى المحاولة بعد 15 دقيقة.'

const DELAYS = [0, 1, 2, 4, 8]

/** Failure-counter window: 10 fails within 15 minutes trigger lockout. */
export const LOGIN_FAIL_TTL_SECONDS = 15 * 60

/** Failures inside the window that activate the lockout. */
export const LOCKOUT_THRESHOLD = 10

/** Lockout duration once activated. */
export const LOCKOUT_DURATION_SECONDS = 15 * 60

const STORE_KEY_PREFIX = 'auth:fail:'
const LOCK_KEY_PREFIX = 'auth:lock:'

/** Hash the readable failure key — raw IPs/usernames never touch the store. */
function storeKey(key: string): string {
  return `${STORE_KEY_PREFIX}${createHash('sha256').update(key).digest('hex')}`
}

function lockKey(key: string): string {
  return `${LOCK_KEY_PREFIX}${createHash('sha256').update(key).digest('hex')}`
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

/** Atomically increment the distributed failure count (returns new count).
 * Crossing LOCKOUT_THRESHOLD activates the lockout (sliding: every further
 * failure refreshes it — sustained attacks stay locked). */
export async function recordLoginFailure(key: string): Promise<number> {
  try {
    const n = await redisIncr(storeKey(key), LOGIN_FAIL_TTL_SECONDS)
    const count = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
    if (count >= LOCKOUT_THRESHOLD) {
      await activateLockout(key)
    }
    return count
  } catch {
    return 0
  }
}

/** Clear the distributed failure count AND any lockout (best-effort). */
export async function clearLoginFailures(key: string): Promise<void> {
  try {
    await redisDel(storeKey(key))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort clear — stale counter expires via TTL
  }
  try {
    await redisDel(lockKey(key))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort clear — stale lock expires via TTL
  }
}

/** Remaining lockout seconds for the key (0 = not locked; fail-open). */
export async function getLockoutRemainingSeconds(key: string): Promise<number> {
  try {
    const expiresAt = await redisGet<number>(lockKey(key))
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return 0
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
  } catch {
    return 0
  }
}

/** Activate (or refresh) the lockout marker (best-effort, fail-open). */
export async function activateLockout(key: string): Promise<void> {
  try {
    await redisSet(lockKey(key), Date.now() + LOCKOUT_DURATION_SECONDS * 1000, LOCKOUT_DURATION_SECONDS)
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort lock — login still delayed + rate-limited
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
