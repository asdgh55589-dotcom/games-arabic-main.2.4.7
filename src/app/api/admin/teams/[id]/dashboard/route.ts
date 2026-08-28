import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const team = await db.team.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
    })

    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    const mods = await db.mod.findMany({
      where: { teamId: id },
      select: {
        id: true,
        name: true,
        workflowStatus: true,
        downloads: true,
        endorsements: true,
        qualityScore: true,
        qualityRating: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const totalMods = mods.length
    const publishedMods = mods.filter((m) => m.workflowStatus === 'PUBLISHED').length
    const draftMods = mods.filter((m) => m.workflowStatus === 'DRAFT').length
    const inReviewMods = mods.filter((m) => m.workflowStatus === 'IN_REVIEW').length
    const totalDownloads = mods.reduce((sum, m) => sum + (m.downloads || 0), 0)
    const totalEndorsements = mods.reduce((sum, m) => sum + (m.endorsements || 0), 0)
    const avgRating = mods.length > 0
      ? mods.filter((m) => m.qualityRating && m.qualityRating > 0)
          .reduce((sum, m) => sum + (m.qualityRating || 0), 0) /
        Math.max(mods.filter((m) => m.qualityRating && m.qualityRating > 0).length, 1)
      : 0
    const avgQuality = totalMods > 0
      ? mods.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / totalMods
      : 0

    // Recent activity (last 10 updated mods)
    const recentActivity = mods.slice(0, 10).map((m) => ({
      modId: m.id,
      modName: m.name,
      status: m.workflowStatus,
      qualityScore: m.qualityScore,
      updatedAt: m.updatedAt,
    }))

    // Mods by status for chart
    const modsByStatus = [
      { status: 'DRAFT', count: draftMods },
      { status: 'IN_REVIEW', count: inReviewMods },
      { status: 'PUBLISHED', count: publishedMods },
      { status: 'ARCHIVED', count: mods.filter((m) => m.workflowStatus === 'ARCHIVED').length },
      { status: 'REJECTED', count: mods.filter((m) => m.workflowStatus === 'REJECTED').length },
    ]

    // Members
    const members = await db.teamMembership.findMany({
      where: { teamId: id },
      select: { id: true, name: true, avatarUrl: true, role: true, userId: true },
    })

    return NextResponse.json({
      team,
      stats: {
        totalMods,
        publishedMods,
        draftMods,
        inReviewMods,
        totalDownloads,
        totalEndorsements,
        avgRating: Math.round(avgRating * 10) / 10,
        avgQuality: Math.round(avgQuality * 10) / 10,
      },
      modsByStatus,
      recentActivity,
      members,
    })
  } catch (error) {
    console.error('[team-dashboard GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
