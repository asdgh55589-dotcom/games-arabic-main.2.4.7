import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    await requireModerator()

    // Get top 5 teams by mod count
    const teams = await db.team.findMany({
      take: 5,
      orderBy: { modCount: 'desc' },
      select: {
        id: true,
        name: true,
        mods: {
          select: {
            qualityScore: true,
            workflowStatus: true,
            endorsements: true,
            downloads: true,
            createdAt: true,
          },
        },
      },
    })

    const result = teams.map((team) => {
      const mods = team.mods
      const published = mods.filter((m) => m.workflowStatus === 'PUBLISHED')
      const total = mods.length

      // Quality: average quality score
      const qualityScores = mods.map((m) => m.qualityScore || 0).filter((s) => s > 0)
      const quality =
        qualityScores.length > 0
          ? Math.round(qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length)
          : 0

      // Completion: published / total
      const completion = total > 0 ? Math.round((published.length / total) * 100) : 0

      // Satisfaction: endorsements per mod
      const totalEndorsements = mods.reduce((s, m) => s + m.endorsements, 0)
      const satisfaction = total > 0 ? Math.round((totalEndorsements / total) * 10) / 10 : 0

      // Consistency: lower std dev = more consistent
      const avg =
        qualityScores.length > 0
          ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
          : 0
      const variance =
        qualityScores.length > 0
          ? qualityScores.reduce((s, v) => s + (v - avg) ** 2, 0) / qualityScores.length
          : 0
      const consistency = Math.round(Math.max(0, 100 - Math.sqrt(variance)))

      return {
        name: team.name,
        metrics: {
          quality,
          completion,
          responseTime: 0, // Would need comment response tracking
          satisfaction,
          consistency,
        },
      }
    })

    return ok({ teams: result }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (err) {
    console.error('[admin/analytics/team-quality] failed:', err)
    return internalError('Failed to load team quality analytics')
  }
}
