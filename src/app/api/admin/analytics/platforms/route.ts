import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

const PLATFORM_LABELS: Record<string, string> = {
  NS: 'Nintendo Switch',
  PS4: 'PS4',
  PS3: 'PS3',
  PS2: 'PS2',
  PS1: 'PS1',
  X360: 'Xbox 360',
  PC: 'PC',
}

export async function GET() {
  try {
    await requireModerator()

    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const [thisMonthMods, lastMonthMods, totalCount] = await Promise.all([
      db.mod.findMany({
        where: { createdAt: { gte: thisMonthStart } },
        select: { game: { select: { platform: true } } },
      }),
      db.mod.findMany({
        where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } },
        select: { game: { select: { platform: true } } },
      }),
      db.mod.count(),
    ])

    // Count by platform
    const thisMonthMap = new Map<string, number>()
    thisMonthMods.forEach((m) => {
      const p = m.game.platform
      thisMonthMap.set(p, (thisMonthMap.get(p) || 0) + 1)
    })

    const lastMonthMap = new Map<string, number>()
    lastMonthMods.forEach((m) => {
      const p = m.game.platform
      lastMonthMap.set(p, (lastMonthMap.get(p) || 0) + 1)
    })

    const allPlatforms = new Set([...thisMonthMap.keys(), ...lastMonthMap.keys()])

    const platforms = Array.from(allPlatforms)
      .map((platform) => {
        const thisCount = thisMonthMap.get(platform) || 0
        const lastCount = lastMonthMap.get(platform) || 0
        return {
          name: PLATFORM_LABELS[platform] || platform,
          count: thisCount,
          percentage: totalCount > 0 ? Math.round((thisCount / totalCount) * 100) : 0,
          trend: thisCount - lastCount,
        }
      })
      .sort((a, b) => b.count - a.count)

    return ok({ platforms }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (err) {
    console.error('[admin/analytics/platforms] failed:', err)
    return internalError('Failed to load platform analytics')
  }
}
