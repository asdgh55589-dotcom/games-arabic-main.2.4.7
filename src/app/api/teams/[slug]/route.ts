import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/teams/[slug] — تفاصيل فريق
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const team = await db.team.findFirst({
      where: { slug },
      include: {
        memberships: { orderBy: { joinedAt: 'desc' } },
        contactLinks: { orderBy: { order: 'asc' } },
        mods: {
          select: {
            id: true, name: true, slug: true, thumbnailUrl: true,
            downloads: true, endorsements: true, views: true,
            game: { select: { platform: true, name: true } },
          },
          orderBy: { downloads: 'desc' },
          take: 50,
        },
        _count: { select: { mods: true, memberships: true } },
      },
    })

    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    const totalDownloads = team.mods.reduce((sum, m) => sum + m.downloads, 0)
    const totalEndorsements = team.mods.reduce((sum, m) => sum + m.endorsements, 0)
    const totalViews = team.mods.reduce((sum, m) => sum + m.views, 0)

    const platforms: Record<string, number> = {}
    for (const mod of team.mods) {
      const p = mod.game?.platform
      if (p) platforms[p] = (platforms[p] || 0) + 1
    }

    const roleBreakdown: Record<string, number> = {}
    for (const m of team.memberships) {
      roleBreakdown[m.role] = (roleBreakdown[m.role] || 0) + 1
    }

    return NextResponse.json(
      {
        team: {
          ...team,
          stats: {
            totalDownloads,
            totalEndorsements,
            totalViews,
            memberCount: team._count.memberships,
            modCount: team._count.mods,
            platforms,
            roleBreakdown,
          },
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    )
  } catch (err) {
    console.error('[api/teams/[slug]] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
