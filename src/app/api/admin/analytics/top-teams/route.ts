import { internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireModerator()

    const teams = await db.team.findMany({
      take: 10,
      orderBy: { modCount: 'desc' },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        modCount: true,
        mods: {
          where: { workflowStatus: 'PUBLISHED' },
          select: { qualityScore: true, downloads: true },
        },
      },
    })

    const result = teams.map((team) => {
      const publishedMods = team.mods
      const avgQuality =
        publishedMods.length > 0
          ? Math.round(
              publishedMods.reduce((sum, m) => sum + (m.qualityScore || 0), 0) /
                publishedMods.length,
            )
          : 0
      const totalDownloads = publishedMods.reduce((sum, m) => sum + m.downloads, 0)

      return {
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        modsCount: team.modCount,
        avgQuality,
        totalDownloads,
      }
    })

    return ok({ teams: result }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (err) {
    console.error('[admin/analytics/top-teams] failed:', err)
    return internalError('Failed to load top teams analytics')
  }
}
