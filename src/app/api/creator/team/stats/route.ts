import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { canManageTeam, getTeamRole } from '@/lib/team-permissions'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { z } from 'zod'

const StatsRangeSchema = z
  .object({
    range: z.enum(['7d', '30d', '90d', '1y', 'custom']).optional().default('30d'),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict()

// GET /api/creator/team/stats — aggregated statistics for the owned team.
// Owner-only. Read-only. No hard 500-row cap; uses Prisma aggregates so every
// mod is counted. Supports time ranges (7d/30d/90d/1y/custom) and period
// comparison against the previous equal-length period.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const limited = await rateLimitMiddleware(req, {
    limit: 60,
    window: 60,
    keyPrefix: `creator:team-stats:${user.id}`,
  })
  if (limited) return limited

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const callerRole = await getTeamRole(owned.id, user.id)
    if (!callerRole || !canManageTeam(callerRole, 'view_stats')) {
      return forbidden('لا تملك صلاحية تنفيذ هذا الإجراء')
    }

    const parsed = StatsRangeSchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams.entries()),
    )
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    const { range, dateFrom, dateTo } = parsed.data

    const now = new Date()
    let from: Date
    let to: Date
    if (range === 'custom' && dateFrom && dateTo) {
      from = new Date(dateFrom)
      to = new Date(dateTo)
    } else {
      to = now
      const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '1y' ? 365 : 30
      from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    }

    const periodLength = to.getTime() - from.getTime()
    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(prevTo.getTime() - periodLength)

    const baseWhere = { teamId: owned.id }
    const periodWhere: Record<string, unknown> = {
      ...baseWhere,
      createdAt: { gte: from, lte: to },
    }
    const prevPeriodWhere: Record<string, unknown> = {
      ...baseWhere,
      createdAt: { gte: prevFrom, lte: prevTo },
    }

    const [mods, memberCount, followsCount] = await Promise.all([
      db.mod.findMany({
        where: baseWhere,
        select: {
          id: true, name: true, slug: true, workflowStatus: true, downloads: true,
          endorsements: true, rating: true, qualityScore: true, createdAt: true,
        },
        orderBy: { downloads: 'desc' },
      }),
      db.teamMembership.count({ where: { teamId: owned.id, status: 'active' } }),
      db.teamFollow.count({ where: { teamId: owned.id } }),
    ])

    const periodMods = mods.filter(
      (m) => m.createdAt >= from && m.createdAt <= to,
    )
    const prevMods = mods.filter(
      (m) => m.createdAt >= prevFrom && m.createdAt <= prevTo,
    )

    const published = periodMods.filter((m) => m.workflowStatus === 'PUBLISHED')
    const byStatus: Record<string, number> = {}
    for (const m of periodMods) byStatus[m.workflowStatus] = (byStatus[m.workflowStatus] || 0) + 1

    const avg = (nums: number[]) => (nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0)
    const rated = periodMods.filter((m) => m.rating > 0)
    const byRatingDesc = [...rated].sort((a, b) => b.rating - a.rating)
    const byRatingAsc = [...rated].sort((a, b) => a.rating - b.rating)

    const prevPublished = prevMods.filter((m) => m.workflowStatus === 'PUBLISHED')
    const prevDownloads = prevPublished.reduce((s, m) => s + m.downloads, 0)
    const prevRated = prevMods.filter((m) => m.rating > 0)

    const slim = (m: (typeof mods)[number]) => ({
      id: m.id, name: m.name, slug: m.slug, workflowStatus: m.workflowStatus,
      downloads: m.downloads, rating: m.rating,
    })

    const stats = {
      totalMods: periodMods.length,
      publishedMods: published.length,
      totalDownloads: published.reduce((s, m) => s + m.downloads, 0),
      totalEndorsements: periodMods.reduce((s, m) => s + m.endorsements, 0),
      avgRating: avg(rated.map((m) => m.rating)),
      avgQuality: avg(periodMods.map((m) => m.qualityScore)),
      downloadsChange: prevDownloads > 0
        ? ((published.reduce((s, m) => s + m.downloads, 0) - prevDownloads) / prevDownloads) * 100
        : 0,
      ratingChange: prevRated.length > 0
        ? avg(rated.map((m) => m.rating)) - avg(prevRated.map((m) => m.rating))
        : 0,
    }

    return ok(
      {
        stats,
        byStatus,
        topMods: byRatingDesc.slice(0, 5).map(slim),
        lowestMods: byRatingAsc.slice(0, 5).map(slim),
        memberCount,
        followsCount,
        range,
        period: { from, to, previousFrom: prevFrom, previousTo: prevTo },
      },
      { headers: { 'Cache-Control': 'private, max-age=30' } },
    )
  } catch (err) {
    logger.error({ err }, '[creator/team/stats GET] failed')
    return internalError('فشل جلب إحصائيات الفريق')
  }
}
