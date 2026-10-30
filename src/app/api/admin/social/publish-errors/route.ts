/**
 * GET /api/admin/social/publish-errors — قائمة أحداث أخطاء النشر (مرحلة 6).
 */
import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { authErrorResponse } from '@/lib/template-lifecycle'

const MAX_LIMIT = 100

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const sp = req.nextUrl.searchParams
    const status = sp.get('status') ?? 'open'
    const scope = sp.get('scope')
    const code = sp.get('code')
    const limit = Math.min(Math.max(Number(sp.get('limit')) || 50, 1), MAX_LIMIT)

    const where = {
      ...(status === 'open' ? { resolvedAt: null } : {}),
      ...(status === 'resolved' ? { resolvedAt: { not: null } } : {}),
      ...(scope ? { scope } : {}),
      ...(code ? { code } : {}),
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const [items, open, last24h] = await Promise.all([
      db.publishErrorEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
      }),
      db.publishErrorEvent.count({ where: { resolvedAt: null } }),
      db.publishErrorEvent.count({
        where: { resolvedAt: null, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ])

    let recent: Array<{
      code?: string
      scope?: string
      refId?: string | null
      createdAt?: Date | string
    }> = []
    try {
      const fetched = await db.publishErrorEvent.findMany({
        where: { createdAt: { gte: fourteenDaysAgo } },
        select: { code: true, scope: true, refId: true, createdAt: true },
        take: 5000,
      })
      if (Array.isArray(fetched)) recent = fetched as typeof recent
    } catch {
      if (Array.isArray(items)) recent = items as typeof recent
    }
    if (!Array.isArray(recent)) recent = Array.isArray(items) ? (items as typeof recent) : []

    const byCode: Record<string, number> = {}
    const byScope: Record<string, number> = {}
    const byDestination: Record<string, number> = {}
    const trendMap = new Map<string, number>()
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      trendMap.set(d.toISOString().slice(0, 10), 0)
    }

    for (const ev of recent) {
      const c = ev?.code || 'unknown'
      const s = ev?.scope || 'unknown'
      byCode[c] = (byCode[c] ?? 0) + 1
      byScope[s] = (byScope[s] ?? 0) + 1
      if (s === 'destination' && ev.refId) {
        byDestination[ev.refId] = (byDestination[ev.refId] ?? 0) + 1
      }
      const day = ev?.createdAt ? new Date(ev.createdAt).toISOString().slice(0, 10) : null
      if (day && trendMap.has(day)) {
        trendMap.set(day, (trendMap.get(day) ?? 0) + 1)
      }
    }

    const trend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

    return ok({
      items,
      counts: { open, last24h },
      limit,
      breakdown: {
        byCode,
        byScope,
        byDestination,
        trend,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const auth = authErrorResponse(err, 'غير مصرح — مركز الأخطاء لمشاهدة الإدارة')
    if (auth) return auth
    logger.error('[admin/social/publish-errors GET] failed:', err)
    return internalError('تعذّر تحميل الأخطاء', undefined, req.nextUrl.pathname)
  }
}

export const dynamic = 'force-dynamic'
