import { createHash, randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { maskId } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { redisDel, redisGet, redisSet } from '@/lib/redis'

const SESSION_TTL_DAYS = 7

/** Ledger liveness cache TTL (seconds). Revoke paths invalidate eagerly. */
const LEDGER_CACHE_TTL_S = 120

/** Never use the raw token as a Redis key — hash it. */
function ledgerCacheKey(token: string): string {
  return `session:active:${createHash('sha256').update(token).digest('hex')}`
}

export interface CreateLedgerOpts {
  ip: string | null
  userAgent: string | null
}

/**
 * ينشئ صف جلسة جديد في جدول session (سجل المركزي)
 * يُستدعى بعد كل تسجيل دخول ناجح (تليجرام/جوجل/إيميل)
 */
export async function createSessionLedger(userId: string, opts: CreateLedgerOpts) {
  const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
  const now = new Date()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  const id = randomUUID()
  const row = await db.session.create({
    data: {
      id,
      token,
      userId,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      ipAddress: opts.ip,
      userAgent: opts.userAgent,
    } as any,
  })
  logger.info({ userId, sessionId: id }, 'session created')
  return row
}

export async function isSessionActive(token: string): Promise<boolean> {
  if (!token) return false
  const cacheKey = ledgerCacheKey(token)
  // Fast path: Redis (120s TTL). The proxy hits this on EVERY authenticated
  // request — without the cache each pageview costs a Postgres query.
  try {
    const cached = await redisGet<boolean>(cacheKey)
    if (cached !== null) return cached
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: cache miss → DB below
  }
  try {
    const s = await db.session.findUnique({ where: { token } as any, select: { expiresAt: true } })
    if (!s) {
      await redisSet(cacheKey, false, LEDGER_CACHE_TTL_S).catch(() => {})
      return false
    }
    const active = new Date((s as any).expiresAt) > new Date()
    await redisSet(cacheKey, active, LEDGER_CACHE_TTL_S).catch(() => {})
    return active
  } catch (err) {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: fail-open liveness check — DB down means "not verifiable", caller treats false as signed-out
    // intentional: expected+handled (fail-open to signed-out), keep return shape
    logger.warn({ event: 'session_ledger_check_failed', err }, 'session liveness check failed')
    return false
  }
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return
  try {
    await db.session.deleteMany({ where: { token } as any })
    // Invalidate the liveness cache so logout takes effect immediately.
    await redisDel(ledgerCacheKey(token)).catch(() => {})
    logger.warn({ token: maskId(token) }, 'session revoked')
  } catch (err) {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort revoke — row may already be gone; nothing to retry
    // intentional: expected+handled (idempotent delete), no state to roll back
    logger.warn({ event: 'session_revoke_failed', err }, 'session revoke failed')
  }
}

export async function revokeOtherSessions(userId: string, currentToken: string) {
  try {
    await db.session.deleteMany({
      where: {
        userId,
        token: { not: currentToken },
      } as any,
    })
    logger.warn({ userId }, 'other sessions revoked')
  } catch (err) {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort revoke — user stays signed in, next login re-sweeps
    // intentional: expected+handled (fail-open, non-blocking for the active session)
    logger.warn({ event: 'session_revoke_others_failed', err }, 'revoke other sessions failed')
  }
}

export async function listUserSessions(userId: string) {
  try {
    const rows = await db.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } } as any,
      orderBy: { updatedAt: 'desc' },
    })
    return rows
  } catch (err) {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: read-only settings page — empty list is a safe degraded render
    // intentional: expected+handled (fail-open to empty list)
    logger.warn({ event: 'session_list_failed', err }, 'list user sessions failed')
    return []
  }
}
