import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const RANGES = new Set([7, 30, 90])

// Per-user KPI payload: client is allowed a short-lived private copy
// (dashboard fetches drop no-store) — stays cookie-varying so per-user
// responses are never cross-served.
const PRIVATE_CACHE = {
  headers: { 'Cache-Control': 'private, max-age=30', Vary: 'Cookie' },
} as const

function changeRate(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

// GET /api/creator/analytics?range=7|30|90 — ملخص بطاقات لوحة المُعَرِّب
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { searchParams } = new URL(req.url)
    const days = Number.parseInt(searchParams.get('range') || '30', 10)
    if (!RANGES.has(days)) {
      return validationFail('النطاق يجب أن يكون 7 أو 30 أو 90 يوماً')
    }

    const limited = await rateLimitMiddleware(req, {
      limit: 30,
      window: 60,
      keyPrefix: `creator:analytics:${user.id}`,
    })
    if (limited) return limited

    const now = new Date()
    const start = new Date(now.getTime() - days * 86400000)
    const prevStart = new Date(start.getTime() - days * 86400000)

    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      select: { id: true },
    })
    const modIds = mods.map((m) => m.id)
    const viewWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, viewedAt: { gte: start } as const }
        : { modId: { in: ['__none__'] } }
    const viewPrevWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, viewedAt: { gte: prevStart, lt: start } as const }
        : { modId: { in: ['__none__'] } }
    const dlWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, createdAt: { gte: start } as const }
        : { modId: { in: ['__none__'] } }
    const dlPrevWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, createdAt: { gte: prevStart, lt: start } as const }
        : { modId: { in: ['__none__'] } }
    const cscWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, createdAt: { gte: start } as const }
        : { modId: { in: ['__none__'] } }
    const cscPrevWhere =
      modIds.length > 0
        ? { modId: { in: modIds }, createdAt: { gte: prevStart, lt: start } as const }
        : { modId: { in: ['__none__'] } }

    const [
      totalViews,
      prevViews,
      totalDownloads,
      prevDownloads,
      totalComments,
      totalLikes,
      newModsThisPeriod,
      activeModsCount,
      totalCommentClicks,
      prevCommentClicks,
      periodLikes,
      prevPeriodLikes,
      newsIds,
    ] = await Promise.all([
      db.modView.count({ where: viewWhere }),
      db.modView.count({ where: viewPrevWhere }),
      db.downloadClick.count({ where: dlWhere }),
      db.downloadClick.count({ where: dlPrevWhere }),
      db.modComment.count({
        where: { mod: { authorId: user.id }, createdAt: { gte: start } },
      }),
      // R14 — الإعجابات من صفوف Endorsement (وليس SUM(Mod.endorsements)).
      // 'thumbsdown' ليس إعجاباً — يُستبعد ويُعرض منفصلاً في صفحة الإعجابات.
      db.endorsement.count({
        where: { mod: { authorId: user.id }, value: { not: 'thumbsdown' } },
      }),
      db.mod.count({ where: { authorId: user.id, createdAt: { gte: start } } }),
      db.mod.count({ where: { authorId: user.id, workflowStatus: 'PUBLISHED' } }),
      db.commentSectionClick.count({ where: cscWhere }),
      db.commentSectionClick.count({ where: cscPrevWhere }),
      db.endorsement.count({
        where: {
          mod: { authorId: user.id },
          createdAt: { gte: start },
          value: { not: 'thumbsdown' },
        },
      }),
      db.endorsement.count({
        where: {
          mod: { authorId: user.id },
          createdAt: { gte: prevStart, lt: start },
          value: { not: 'thumbsdown' },
        },
      }),
      db.news.findMany({ where: { authorId: user.id, visible: true, publishAt: { lte: now } }, select: { id: true } }),
    ])

    const newsIdList = newsIds.map((n) => n.id)
    const [newsViews, prevNewsViews] = newsIdList.length
      ? await Promise.all([
          db.newsView.count({ where: { newsId: { in: newsIdList }, viewedAt: { gte: start } } }),
          db.newsView.count({ where: { newsId: { in: newsIdList }, viewedAt: { gte: prevStart, lt: start } } }),
        ])
      : [0, 0]

    const pct = (num: number, den: number) =>
      den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0

    return ok(
      {
        range: days,
        totalViews,
        viewsChange: changeRate(totalViews, prevViews),
        totalDownloads,
        downloadsChange: changeRate(totalDownloads, prevDownloads),
        totalComments,
        // R14 — إجمالي الإعجابات مدى الحياة من صفوف Endorsement (بلا thumbsdown)
        totalLikes,
        newModsThisPeriod,
        activeModsCount,
        // Wave B Task 5 — funnel step 3 (comment-section opens).
        totalCommentClicks,
        commentClicksChange: changeRate(totalCommentClicks, prevCommentClicks),
        // Wave B Task 6 — period KPIs for the KPI-card shell.
        periodLikes,
        periodLikesChange: changeRate(periodLikes, prevPeriodLikes),
        newsViews,
        newsViewsChange: changeRate(newsViews, prevNewsViews),
        funnel: {
          views: totalViews,
          downloads: totalDownloads,
          commentClicks: totalCommentClicks,
          viewToDownloadPct: pct(totalDownloads, totalViews),
          downloadToClickPct: pct(totalCommentClicks, totalDownloads),
        },
      },
      PRIVATE_CACHE,
    )
  } catch (err) {
    logger.error('[creator/analytics GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/analytics' })
    return internalError('فشل جلب التحليلات')
  }
}
