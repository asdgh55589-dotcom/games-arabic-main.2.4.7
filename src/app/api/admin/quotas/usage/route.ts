import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/quotas/usage?days=7 — recent daily usage + top storage users
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const days = Math.min(30, Math.max(1, Math.floor(Number(new URL(req.url).searchParams.get('days')) || 7)))
    const since = new Date()
    since.setUTCDate(since.getUTCDate() - (days - 1))
    const sinceKey = since.toISOString().slice(0, 10)

    const [daily, storage] = await Promise.all([
      db.uploadUsageDaily.findMany({
        where: { date: { gte: sinceKey } },
        orderBy: [{ date: 'desc' }, { bytes: 'desc' }],
        take: 200,
      }),
      db.creatorStorage.findMany({ orderBy: { totalBytes: 'desc' }, take: 50 }),
    ])

    const userIds = [...new Set([...daily.map((d) => d.userId), ...storage.map((s) => s.userId)])]
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, role: true },
    })
    const byId = new Map(users.map((u) => [u.id, u]))

    return ok({
      daily: daily.map((d) => ({
        userId: d.userId,
        user: byId.get(d.userId) ?? null,
        date: d.date,
        count: d.count,
        bytes: Number(d.bytes),
      })),
      storage: storage.map((s) => ({
        userId: s.userId,
        user: byId.get(s.userId) ?? null,
        totalBytes: Number(s.totalBytes),
        filesCount: s.filesCount,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'فشل تحميل الاستهلاك')
  }
}
