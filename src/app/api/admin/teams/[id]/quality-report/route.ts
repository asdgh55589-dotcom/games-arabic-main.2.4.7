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
      select: { name: true, id: true },
    })

    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    const mods = await db.mod.findMany({
      where: { teamId: id },
      select: {
        id: true,
        name: true,
        qualityScore: true,
        qualityRating: true,
        qualityRatingsCount: true,
        downloads: true,
        endorsements: true,
        workflowStatus: true,
        createdAt: true,
      },
    })

    const publishedMods = mods.filter((m) => m.workflowStatus === 'PUBLISHED')
    const totalMods = mods.length
    const completionRate = totalMods > 0 ? (publishedMods.length / totalMods) * 100 : 0

    const avgQualityScore = totalMods > 0
      ? mods.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / totalMods
      : 0

    const avgRating = totalMods > 0
      ? mods.filter((m) => m.qualityRating && m.qualityRating > 0)
          .reduce((sum, m) => sum + (m.qualityRating || 0), 0) /
        Math.max(mods.filter((m) => m.qualityRating && m.qualityRating > 0).length, 1)
      : 0

    const totalDownloads = mods.reduce((sum, m) => sum + (m.downloads || 0), 0)
    const totalEndorsements = mods.reduce((sum, m) => sum + (m.endorsements || 0), 0)

    const topRated = [...mods]
      .filter((m) => m.qualityRating && m.qualityRating > 0)
      .sort((a, b) => (b.qualityRating || 0) - (a.qualityRating || 0))
      .slice(0, 5)

    const lowestRated = [...mods]
      .filter((m) => m.qualityRating && m.qualityRating > 0)
      .sort((a, b) => (a.qualityRating || 0) - (b.qualityRating || 0))
      .slice(0, 5)

    const recentActivity = [...mods]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .map((m) => ({
        modId: m.id,
        modName: m.name,
        status: m.workflowStatus,
        qualityScore: m.qualityScore,
        date: m.createdAt,
      }))

    return NextResponse.json({
      team: { id: team.id, name: team.name },
      summary: {
        totalMods,
        publishedMods: publishedMods.length,
        completionRate: Math.round(completionRate * 10) / 10,
        avgQualityScore: Math.round(avgQualityScore * 10) / 10,
        avgRating: Math.round(avgRating * 10) / 10,
        totalDownloads,
        totalEndorsements,
      },
      topRated,
      lowestRated,
      recentActivity,
    })
  } catch (error) {
    console.error('[team-quality-report]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
