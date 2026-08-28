import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/news/[id]/stats — إحصائيات مشاهدات ونقرات خبر
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const news = await db.news.findUnique({
      where: { id },
      select: { id: true, title: true, views: true, clicksCount: true },
    })
    if (!news) return notFound('الخبر غير موجود')

    const [recentViews, recentClicks, totalViews, totalClicks] = await Promise.all([
      db.newsView.findMany({
        where: { newsId: id },
        orderBy: { viewedAt: 'desc' },
        take: 100,
        select: { id: true, ipAddress: true, userAgent: true, viewedAt: true, userId: true },
      }),
      db.newsClick.findMany({
        where: { newsId: id },
        orderBy: { clickedAt: 'desc' },
        take: 100,
        select: { id: true, ipAddress: true, userAgent: true, clickedAt: true, userId: true },
      }),
      db.newsView.count({ where: { newsId: id } }),
      db.newsClick.count({ where: { newsId: id } }),
    ])

    // Group by date for charts
    const viewsByDateMap = new Map<string, number>()
    for (const v of recentViews) {
      const d = v.viewedAt.toISOString().split('T')[0]
      viewsByDateMap.set(d, (viewsByDateMap.get(d) || 0) + 1)
    }
    const viewsByDate = Array.from(viewsByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const clicksByDateMap = new Map<string, number>()
    for (const c of recentClicks) {
      const d = c.clickedAt.toISOString().split('T')[0]
      clicksByDateMap.set(d, (clicksByDateMap.get(d) || 0) + 1)
    }
    const clicksByDate = Array.from(clicksByDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return ok({
      news,
      totalViews,
      totalClicks,
      viewsCount: news.views,
      clicksCount: news.clicksCount,
      recentViews,
      recentClicks,
      viewsByDate,
      clicksByDate,
    })
  } catch (err) {
    console.error('[admin news stats] failed:', err)
    return internalError('Failed')
  }
}
