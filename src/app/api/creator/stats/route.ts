import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const authorWhere = { authorId: user.id }
    const publishedWhere = { authorId: user.id, workflowStatus: 'PUBLISHED' }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [totalMods, statusGroups, sums, rating, topMods, recentMods] = await Promise.all([
      db.mod.count({ where: authorWhere }),
      db.mod.groupBy({
        by: ['workflowStatus'],
        where: authorWhere,
        _count: { workflowStatus: true },
      }),
      db.mod.aggregate({
        where: publishedWhere,
        _sum: { views: true, downloads: true, endorsements: true, comments: true },
      }),
      db.mod.aggregate({
        where: { ...publishedWhere, ratingCount: { gt: 0 } },
        _avg: { rating: true },
      }),
      db.mod.findMany({
        where: publishedWhere,
        select: {
          id: true,
          name: true,
          slug: true,
          downloads: true,
          views: true,
          rating: true,
          isOriginalWork: true,
        },
        orderBy: { downloads: 'desc' },
        take: 5,
      }),
      db.mod.findMany({
        where: { authorId: user.id, createdAt: { gte: thirtyDaysAgo } },
        select: { id: true, name: true, workflowStatus: true, createdAt: true, isOriginalWork: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const countFor = (status: string) =>
      statusGroups.find((g) => g.workflowStatus === status)?._count.workflowStatus ?? 0

    return ok({
      totals: {
        totalMods,
        published: countFor('PUBLISHED'),
        drafts: countFor('DRAFT'),
        pending: countFor('IN_REVIEW'),
        rejected: countFor('REJECTED'),
        totalViews: sums._sum.views ?? 0,
        totalDownloads: sums._sum.downloads ?? 0,
        totalEndorsements: sums._sum.endorsements ?? 0,
        totalComments: sums._sum.comments ?? 0,
        averageRating: Number((rating._avg.rating ?? 0).toFixed(2)),
      },
      topMods: topMods.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        downloads: m.downloads,
        views: m.views,
        rating: m.rating,
        isOriginalWork: m.isOriginalWork,
      })),
      recentActivity: recentMods.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.workflowStatus,
        createdAt: m.createdAt,
        isOriginalWork: m.isOriginalWork,
      })),
    })
  } catch (err) {
    console.error('[creator/stats GET] failed:', err)
    return internalError('فشل جلب الإحصائيات')
  }
}
