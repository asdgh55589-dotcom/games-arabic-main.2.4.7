import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/ads/[id]/stats — إحصائيات نقرات إعلان
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const ad = await db.homepageAd.findUnique({ where: { id }, select: { id: true, clicksCount: true, title: true } })
    if (!ad) return notFound('الإعلان غير موجود')

    const [recentClicks, totalClicks, clicksByDateRaw] = await Promise.all([
      db.adClick.findMany({
        where: { adId: id },
        orderBy: { clickedAt: 'desc' },
        take: 100,
        select: { id: true, ipAddress: true, userAgent: true, referrer: true, clickedAt: true, userId: true },
      }),
      db.adClick.count({ where: { adId: id } }),
      db.adClick.groupBy({
        by: ['clickedAt'],
        where: { adId: id },
        _count: true,
      }).catch(() => []),
    ])

    // Group by date string for chart
    const clicksByDateMap = new Map<string, number>()
    for (const c of recentClicks) {
      const d = c.clickedAt.toISOString().split('T')[0]
      clicksByDateMap.set(d, (clicksByDateMap.get(d) || 0) + 1)
    }
    const clicksByDate = Array.from(clicksByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return ok({
      ad,
      totalClicks,
      clicksCount: ad.clicksCount,
      recentClicks,
      clicksByDate,
    })
  } catch (err) {
    console.error('[admin ads stats] failed:', err)
    return internalError('Failed')
  }
}
