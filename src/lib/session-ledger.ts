import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const SESSION_TTL_DAYS = 7

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
  try {
    const s = await db.session.findUnique({ where: { token } as any, select: { expiresAt: true } })
    if (!s) return false
    return new Date((s as any).expiresAt) > new Date()
  } catch {
    return false
  }
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return
  try {
    await db.session.deleteMany({ where: { token } as any })
    logger.warn({ token: `${token.slice(0, 8)}...` }, 'session revoked')
  } catch {}
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
  } catch {}
}

export async function listUserSessions(userId: string) {
  try {
    const rows = await db.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } } as any,
      orderBy: { updatedAt: 'desc' },
    })
    return rows
  } catch {
    return []
  }
}
