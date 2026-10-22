import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const limited = await rateLimitMiddleware(req, {
      limit: 60,
      window: 60,
      keyPrefix: `creator:stats:${user.id}`,
    })
    if (limited) return limited

    const authorWhere = { authorId: user.id }
    const publishedWhere = { authorId: user.id, workflowStatus: 'PUBLISHED' }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // R14 — مصدر واحد للأرقام: صفوف السجلات (ModView / DownloadClick / ModComment)
    // بدل مجاميع العدّادات (SUM(Mod.views) …). العدّادات تحتوي على بيانات مزروعة
    // غير قابلة للتدقيق، أما الصفوف فكل رقم فيها قابل للتحقق منه.
    const [totalMods, statusGroups, rating, recentMods, draftsCount, pendingCount, rejectedCount, allTimeViews, allTimeDownloads, allTimeComments, dlGroups, viewGroups] = await Promise.all([
      db.mod.count({ where: authorWhere }),
      db.mod.groupBy({
        by: ['workflowStatus'],
        where: authorWhere,
        _count: { workflowStatus: true },
      }),
      db.mod.aggregate({
        where: { ...publishedWhere, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
      db.mod.findMany({
        where: { authorId: user.id, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, name: true, workflowStatus: true, createdAt: true, isOriginalWork: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.mod.count({ where: { authorId: user.id, workflowStatus: 'DRAFT' } }),
      db.mod.count({ where: { authorId: user.id, workflowStatus: 'IN_REVIEW' } }),
      db.mod.count({ where: { authorId: user.id, workflowStatus: 'REJECTED' } }),
      db.modView.count({ where: { mod: { authorId: user.id } } }),
      db.downloadClick.count({ where: { mod: { authorId: user.id } } }),
      db.modComment.count({ where: { mod: { authorId: user.id } } }),
      // أعلى التعريبات تحميلاً — الترتيب من صفوف DownloadClick لا من العدّاد
      db.downloadClick.groupBy({
        by: ['modId'],
        where: { mod: publishedWhere },
        _count: { _all: true },
        orderBy: { _count: { modId: 'desc' } },
        take: 5,
      }),
      db.modView.groupBy({
        by: ['modId'],
        where: { mod: publishedWhere },
        _count: { _all: true },
      }),
    ])

    const countFor = (status: string) =>
      statusGroups.find((g) => g.workflowStatus === status)?._count.workflowStatus ?? 0

    // صفوف أعلى التعريبات — أرقام الصفوف فقط (لا عدّادات)
    const topIds = dlGroups.map((g) => g.modId)
    const topModRows = topIds.length
      ? await db.mod.findMany({
          where: { id: { in: topIds }, authorId: user.id },
          select: { id: true, name: true, slug: true, rating: true, isOriginalWork: true },
          take: 5,
        })
      : []
    const topModById = new Map(topModRows.map((m) => [m.id, m]))
    const viewsByMod = new Map(viewGroups.map((g) => [g.modId, g._count._all]))
    const topMods = dlGroups.map((g) => {
      const m = topModById.get(g.modId)
      return {
        id: g.modId,
        name: m?.name ?? '—',
        slug: m?.slug ?? '',
        downloads: g._count._all,
        views: viewsByMod.get(g.modId) ?? 0,
        rating: m?.rating ?? 0,
        isOriginalWork: m?.isOriginalWork ?? null,
      }
    })

    return ok({
      totals: {
        totalMods,
        published: countFor('PUBLISHED'),
        drafts: draftsCount,
        pending: pendingCount,
        rejected: rejectedCount,
        // إجماليات مدى الحياة — كلها من صفوف السجلات (قابلة للتدقيق)
        allTimeViews,
        allTimeDownloads,
        allTimeComments,
        averageRating: Number((rating._avg.rating ?? 0).toFixed(2)),
      },
      topMods,
      recentActivity: recentMods.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.workflowStatus,
        createdAt: m.createdAt,
        isOriginalWork: m.isOriginalWork,
      })),
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    logger.error('[creator/stats GET] failed:', err)
    return internalError('فشل جلب الإحصائيات')
  }
}
