import { internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/dashboard — إحصائيات + آخر النشاطات
export async function GET() {
  try {
    console.time('[admin-dashboard total]')

    await requireModerator()

    console.time('[admin-dashboard queries]')

    const [
      gamesCount,
      modsCount,
      usersCount,
      downloadsAgg,
      endorsementsAgg,
      commentsCount,
      featuredCount,
      trendingCount,
      seriesCount,
      recentMods,
      recentUsers,
      recentComments,
    ] = await Promise.all([
      db.game.count(),
      db.mod.count(),
      db.user.count(),
      db.mod.aggregate({ _sum: { downloads: true } }),
      db.mod.aggregate({ _sum: { endorsements: true } }),
      db.modComment.count(),
      db.mod.count({ where: { isFeatured: true } }),
      db.mod.count({ where: { isTrending: true } }),
      db.series.count(),
      db.mod.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { game: { select: { name: true, platform: true } } },
      }),
      db.user.findMany({
        take: 5,
        orderBy: { joinedAt: 'desc' },
        select: { id: true, username: true, avatarUrl: true, role: true, joinedAt: true },
      }),
      db.modComment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { mod: { select: { name: true, slug: true } } },
      }),
    ])

    console.timeEnd('[admin-dashboard queries]')

    const response = ok(
      {
        stats: {
          games: gamesCount,
          mods: modsCount,
          users: usersCount,
          downloads: downloadsAgg._sum.downloads || 0,
          endorsements: endorsementsAgg._sum.endorsements || 0,
          comments: commentsCount,
          featured: featuredCount,
          trending: trendingCount,
          series: seriesCount,
        },
        recent: {
          mods: recentMods,
          users: recentUsers,
          comments: recentComments,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=15',
        },
      },
    )

    console.timeEnd('[admin-dashboard total]')

    return response
  } catch (err) {
    console.error('[admin/dashboard] failed:', err)
    return internalError('Failed to load dashboard data')
  }
}
