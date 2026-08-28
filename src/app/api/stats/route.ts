import { db } from '@/lib/db'
import { ok } from '@/lib/api-response'
import type { SiteStats } from '@/lib/types'

// GET /api/stats - aggregate site-wide stats
export async function GET() {
  const [games, mods, downloadsAgg, endorsementsAgg, users] = await Promise.all([
    db.game.count(),
    db.mod.count(),
    db.mod.aggregate({ _sum: { downloads: true } }),
    db.mod.aggregate({ _sum: { endorsements: true } }),
    db.user.count(),
  ])

  return ok<SiteStats>(
    {
      games,
      mods,
      downloads: downloadsAgg._sum.downloads || 0,
      endorsements: endorsementsAgg._sum.endorsements || 0,
      users,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    }
  )
}
