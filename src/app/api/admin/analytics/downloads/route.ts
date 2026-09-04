import type { NextRequest } from 'next/server'
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

type Period = '7d' | '30d' | '90d' | 'all'

function parsePeriod(value: string | null): { period: Period; days: number | null } {
  switch (value) {
    case '7d':
      return { period: '7d', days: 7 }
    case '90d':
      return { period: '90d', days: 90 }
    case 'all':
      return { period: 'all', days: null }
    case '30d':
    default:
      return { period: '30d', days: 30 }
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const { period, days } = parsePeriod(searchParams.get('period'))

    const now = new Date()
    const gte = days !== null ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : undefined

    // Single source of truth: DownloadClick table
    const clicks = await db.downloadClick.findMany({
      where: gte ? { createdAt: { gte } } : undefined,
      select: {
        createdAt: true,
        modId: true,
        mod: {
          select: {
            id: true,
            name: true,
            slug: true,
            endorsements: true,
            teamId: true,
            game: { select: { name: true, platform: true } },
            teamRelation: { select: { name: true } },
          },
        },
      },
    })

    const total = clicks.length

    // Daily trend — grouped by date (single source)
    const dailyMap = new Map<string, number>()
    if (days !== null) {
      for (let i = 0; i < days; i++) {
        const d = new Date(now)
        d.setDate(d.getDate() - days + 1 + i)
        dailyMap.set(d.toISOString().split('T')[0], 0)
      }
    }
    for (const c of clicks) {
      const key = new Date(c.createdAt).toISOString().split('T')[0]
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // byPlatform — grouped by game.platform via DownloadClick -> mod.game
    const platformMap = new Map<string, number>()
    for (const c of clicks) {
      const p = c.mod?.game?.platform || 'UNKNOWN'
      platformMap.set(p, (platformMap.get(p) || 0) + 1)
    }
    const byPlatform = Array.from(platformMap.entries())
      .map(([platform, downloads]) => ({
        platform: PLATFORM_LABELS[platform] || platform,
        downloads,
        _raw: platform,
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .map(({ _raw, ...rest }) => rest)

    // byTeam — grouped by teamId via mod.teamId
    const teamMap = new Map<string, number>()
    for (const c of clicks) {
      const tid = c.mod?.teamId
      if (tid) teamMap.set(tid, (teamMap.get(tid) || 0) + 1)
    }
    const teamIds = Array.from(teamMap.keys())
    const teams = teamIds.length
      ? await db.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true } })
      : []
    const teamNameMap = new Map(teams.map((t) => [t.id, t.name]))
    const byTeam = Array.from(teamMap.entries())
      .map(([teamId, downloads]) => ({
        teamId,
        name: teamNameMap.get(teamId) || 'غير معروف',
        downloads,
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 10)

    // topMods — grouped by modId, counted from DownloadClick
    const modMap = new Map<string, { count: number; mod: (typeof clicks)[0]['mod'] }>()
    for (const c of clicks) {
      const existing = modMap.get(c.modId)
      if (existing) {
        existing.count++
      } else {
        modMap.set(c.modId, { count: 1, mod: c.mod })
      }
    }
    const topMods = Array.from(modMap.entries())
      .map(([modId, { count, mod }]) => ({
        id: modId,
        name: mod?.name || 'غير معروف',
        slug: mod?.slug || '',
        downloads: count,
        endorsements: mod?.endorsements ?? 0,
        gameName: mod?.game?.name || 'غير معروف',
        platform: mod?.game ? PLATFORM_LABELS[mod.game.platform] || mod.game.platform : 'UNKNOWN',
        teamName: mod?.teamRelation?.name || null,
      }))
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, 20)

    // Verification helper: sums should equal total
    const dailySum = dailyTrend.reduce((s, d) => s + d.count, 0)
    const platformSum = byPlatform.reduce((s, p) => s + p.downloads, 0)

    return ok(
      {
        period,
        total,
        topMods,
        dailyTrend,
        byPlatform,
        byTeam,
        _verification: {
          dailySum,
          platformSum,
          total,
          consistent: dailySum === total && platformSum === total,
        },
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    )
  } catch (err) {
    console.error('[admin/analytics/downloads] failed:', err)
    return internalError('Failed to load downloads analytics')
  }
}
