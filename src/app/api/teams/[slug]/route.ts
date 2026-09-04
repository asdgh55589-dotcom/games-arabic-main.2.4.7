import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { recordTeamView } from '@/lib/counters'
import { db } from '@/lib/db'

// GET /api/teams/[slug] — تفاصيل فريق
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const team = await db.team.findFirst({
      where: { slug },
      include: {
        memberships: {
          orderBy: { joinedAt: 'desc' },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
        contactLinks: { orderBy: { order: 'asc' } },
        customTabs: { where: { visible: true }, orderBy: { order: 'asc' } },
        mods: {
          select: {
            id: true,
            name: true,
            slug: true,
            thumbnailUrl: true,
            downloads: true,
            endorsements: true,
            views: true,
            game: { select: { platform: true, name: true } },
          },
          orderBy: { downloads: 'desc' },
          take: 50,
        },
        _count: { select: { mods: true, memberships: true, follows: true } },
      },
    })

    if (!team) {
      return notFound()
    }

    // Fire-and-forget: مشاهدات صفحة الفريق مع dedup (user 24h / IP+UA 1h، bots مرفوضة)
    recordTeamView(team.id, req, db).catch((err) => {
      console.error('[api/teams/[slug]] failed to record team view:', err)
    })

    // إعادة القراءة بعد التسجيل قد تكون قديمة بثانية — مقبول لعداد عرض فقط
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

    return ok(
      {
        team: {
          ...team,
          stats: {
            totalDownloads,
            totalEndorsements,
            totalViews,
            profileViews: team.views, // مشاهدات صفحة الفريق نفسها
            memberCount: team._count.memberships,
            modCount: team._count.mods,
            followersCount: team._count.follows,
            platforms,
            roleBreakdown,
          },
        },
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      },
    )
  } catch (err) {
    console.error('[api/teams/[slug]] failed:', err)
    return internalError('Failed')
  }
}
