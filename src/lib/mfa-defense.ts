/**
 * lib/mfa-defense.ts — distributed per-account MFA attempt counter.
 *
 * Why a second counter next to `lib/login-defense.ts`:
 * login-defense keys on `IP::identifier` and its lockout semantics are tied to
 * the FIRST factor (password). The second factor (TOTP code) has a different
 * threat model: the caller already proved factor 1 by holding the short-lived
 * MFA challenge token, so an attacker who stole it must be stopped from
 * brute-forcing the 6-digit code (1e6 space, ~4 valid codes at 30s step). That
 * attack is per-ACCOUNT, not per-IP, so it needs an account-scoped counter.
 *
 * Design constraints:
 * - Counters live in the SHARED store (Redis via @/lib/redis, atomic INCR +
 *   TTL) — never module memory — so they survive restarts and are shared
 *   across instances.
 * - Key = `auth:mfa-fail:<sha256 hex of userId>`; the raw id never touches
 *   the store.
 * - Window equals the MFA token lifetime (10m): once the challenge token
 *   expires a fresh challenge is required anyway, so the counter expires with
 *   it instead of needing an explicit reset.
 * - ALL store failures are fail-OPEN (never throw) so a degraded Redis cannot
 *   lock every legitimate user out of their own account.
 */

import { createHash } from 'node:crypto'
import { redisDel, redisGet, redisIncr } from './redis'

/** Counter window — matches the MFA challenge token TTL (mfa-token.ts). */
export const MFA_ATTEMPT_TTL_SECONDS = 10 * 60

/** Failed TOTP verifications inside the window that block the account. */
export const MFA_MAX_ATTEMPTS = 5

/** Lockout message shown when the counter is exhausted. */
export const MFA_LOCKED_MESSAGE = 'محاولات تحقق كثيرة — أعد تسجيل الدخول بعد قليل'

const STORE_KEY_PREFIX = 'auth:mfa-fail:'

function storeKey(userId: string): string {
  return `${STORE_KEY_PREFIX}${createHash('sha256').update(userId).digest('hex')}`
}

/** Current failed-attempt count for an account (0 when unverifiable). */
export async function getMfaAttempts(userId: string): Promise<number> {
  try {
    const v = await redisGet<number>(storeKey(userId))
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
  } catch {
    return 0
  }
}

/** Atomically record one failed attempt and return the new count (fail-open). */
export async function recordMfaFailure(userId: string): Promise<number> {
  try {
    const n = await redisIncr(storeKey(userId), MFA_ATTEMPT_TTL_SECONDS)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

/** Clear the counter after a successful verification (best-effort). */
export async function clearMfaFailures(userId: string): Promise<void> {
  try {
    await redisDel(storeKey(userId))
  } catch {
    // Stale counter simply expires via its TTL — no action needed.
  }
}

/** True when the account has exhausted its second-factor attempts. */
export async function isMfaLocked(userId: string): Promise<boolean> {
  return (await getMfaAttempts(userId)) >= MFA_MAX_ATTEMPTS
}
