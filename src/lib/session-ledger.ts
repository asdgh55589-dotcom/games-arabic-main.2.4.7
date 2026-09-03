import { db } from '@/lib/db'
import { randomUUID } from 'crypto'

const SESSION_TTL_DAYS = 7
const TOUCH_THROTTLE_MS = 60 * 1000

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
  return row
}

/**
 * يحدّث updatedAt للجلسة (throttled دقيقة)
 */
export async function touchSession(token: string): Promise<void> {
  try {
    const s = await db.session.findUnique({ where: { token } as any, select: { updatedAt: true } })
    if (!s) return
    const last = new Date((s as any).updatedAt).getTime()
    if (Date.now() - last < TOUCH_THROTTLE_MS) return
    await db.session.update({ where: { token } as any, data: { updatedAt: new Date() } as any })
  } catch {}
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

export async function listAllSessions(opts: {
  search?: string
  device?: string
  time?: string
  page: number
  limit: number
}) {
  const where: any = { expiresAt: { gt: new Date() } }
  if (opts.time === 'hour') where.createdAt = { gte: new Date(Date.now() - 60 * 60 * 1000) }
  else if (opts.time === 'day') where.createdAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  else if (opts.time === 'week') where.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  if (opts.device) where.userAgent = { contains: opts.device, mode: 'insensitive' }
  if (opts.search) {
    where.user = {
      OR: [
        { username: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
        { displayName: { contains: opts.search, mode: 'insensitive' } },
      ],
    }
  }
  const [total, rows] = await Promise.all([
    db.session.count({ where }),
    db.session.findMany({
      where,
      include: { user: { select: { id: true, username: true, displayName: true, email: true, avatarUrl: true, role: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
  ])
  return { total, rows }
}

export function getSessionCookieName() {
  return 'ga_session_ledger'
}

export function generateLedgerToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}
