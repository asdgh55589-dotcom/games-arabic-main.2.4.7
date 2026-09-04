import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const mods = await db.mod.findMany({
    where: { authorId: user.id },
    select: {
      id: true,
      name: true,
      slug: true,
      workflowStatus: true,
      views: true,
      downloads: true,
      endorsements: true,
      rating: true,
      ratingCount: true,
      comments: true,
      createdAt: true,
      updatedAt: true,
      isOriginalWork: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const published = mods.filter((m) => m.workflowStatus === 'PUBLISHED')
  const drafts = mods.filter((m) => m.workflowStatus === 'DRAFT')
  const pending = mods.filter((m) => m.workflowStatus === 'IN_REVIEW')
  const rejected = mods.filter((m) => m.workflowStatus === 'REJECTED')

  const totalViews = published.reduce((sum, m) => sum + (m.views || 0), 0)
  const totalDownloads = published.reduce((sum, m) => sum + (m.downloads || 0), 0)
  const totalEndorsements = published.reduce((sum, m) => sum + (m.endorsements || 0), 0)
  const totalComments = published.reduce((sum, m) => sum + (m.comments || 0), 0)

  const ratedMods = published.filter((m) => m.ratingCount > 0)
  const averageRating =
    ratedMods.length > 0
      ? ratedMods.reduce((sum, m) => sum + (m.rating || 0), 0) / ratedMods.length
      : 0

  const topMods = [...published].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 5)

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentMods = mods.filter((m) => m.createdAt >= thirtyDaysAgo)

  return ok({
    totals: {
      totalMods: mods.length,
      published: published.length,
      drafts: drafts.length,
      pending: pending.length,
      rejected: rejected.length,
      totalViews,
      totalDownloads,
      totalEndorsements,
      totalComments,
      averageRating: Number(averageRating.toFixed(2)),
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
}
