import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

// GET /api/creator/team/stats — aggregated statistics for the owned team.
// Owner-only. Read-only; no rate limit. Computed live from the team's mods
// (mirrors the admin dashboard aggregation shape, scoped + authenticated).
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const [mods, memberCount, followsCount] = await Promise.all([
      db.mod.findMany({
        where: { teamId: owned.id },
        select: {
          id: true,
          name: true,
          slug: true,
          workflowStatus: true,
          downloads: true,
          endorsements: true,
          rating: true,
          qualityScore: true,
          createdAt: true,
        },
      }),
      db.teamMembership.count({ where: { teamId: owned.id } }),
      db.teamFollow.count({ where: { teamId: owned.id } }),
    ])

    const published = mods.filter((m) => m.workflowStatus === 'PUBLISHED')
    const byStatus: Record<string, number> = {}
    for (const m of mods) {
      byStatus[m.workflowStatus] = (byStatus[m.workflowStatus] || 0) + 1
    }
    const rated = mods.filter((m) => m.rating > 0)
    const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)
    const byRatingDesc = [...rated].sort((a, b) => b.rating - a.rating)
    const byRatingAsc = [...rated].sort((a, b) => a.rating - b.rating)
    const slim = (m: (typeof mods)[number]) => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      workflowStatus: m.workflowStatus,
      downloads: m.downloads,
      rating: m.rating,
    })

    return ok({
      stats: {
        totalMods: mods.length,
        publishedMods: published.length,
        totalDownloads: published.reduce((s, m) => s + m.downloads, 0),
        totalEndorsements: mods.reduce((s, m) => s + m.endorsements, 0),
        avgRating: avg(rated.map((m) => m.rating)),
        avgQuality: avg(mods.map((m) => m.qualityScore)),
      },
      byStatus,
      topMods: byRatingDesc.slice(0, 5).map(slim),
      lowestMods: byRatingAsc.slice(0, 5).map(slim),
      memberCount,
      followsCount,
    })
  } catch (err) {
    logger.error({ err }, '[creator/team/stats GET] failed')
    return internalError('فشل جلب إحصائيات الفريق')
  }
}
