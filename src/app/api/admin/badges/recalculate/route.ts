import { internalError, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import {
  decideRecalcBadges,
  getBadgeSettings,
  logBadgeChange,
} from '@/lib/badges'
import { db } from '@/lib/db'

const BATCH = 200

function fmtDate(v: Date | null): string {
  return v ? v.toISOString() : '-'
}

// GET /api/admin/badges/recalculate — إعادة حساب شارات كل التعريبات.
// للاستدعاء اليدوي من لوحة الأدمن أو عبر cron خارجي.
export async function GET() {
  try {
    const user = await requireModerator()
    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const settings = await getBadgeSettings(db)

    let scanned = 0
    let updated = 0
    let logged = 0
    let cursor: string | undefined

    for (;;) {
      const mods = await db.mod.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          isFeatured: true,
          isTrending: true,
          isLatest: true,
          featuredLevel: true,
          featuredUntil: true,
          trendingUntil: true,
          popularUntil: true,
          hiddenBadges: true,
          dailyDownloads: true,
        },
      })
      if (mods.length === 0) break

      const counts = await db.downloadClick.groupBy({
        by: ['modId'],
        where: { modId: { in: mods.map((m) => m.id) }, createdAt: { gte: since } },
        _count: { modId: true },
      })
      const countByMod = new Map(counts.map((c) => [c.modId, c._count.modId]))

      for (const mod of mods) {
        const downloadsLast24h = countByMod.get(mod.id) ?? 0
        const next = decideRecalcBadges(mod, downloadsLast24h, settings, now)

        const changed =
          next.isFeatured !== mod.isFeatured ||
          next.isTrending !== mod.isTrending ||
          next.isLatest !== mod.isLatest ||
          next.featuredLevel !== mod.featuredLevel ||
          fmtDate(next.featuredUntil) !== fmtDate(mod.featuredUntil) ||
          fmtDate(next.trendingUntil) !== fmtDate(mod.trendingUntil) ||
          fmtDate(next.popularUntil) !== fmtDate(mod.popularUntil)

        const counterChanged =
          next.dailyDownloads !== mod.dailyDownloads

        if (!changed && !counterChanged) continue

        await db.mod.update({ where: { id: mod.id }, data: next })
        updated++

        if (changed) {
          const before = [
            `featured=${mod.isFeatured ? `L${mod.featuredLevel ?? '?'}@${fmtDate(mod.featuredUntil)}` : 'off'}`,
            `trending=${mod.isTrending ? 'on' : 'off'}`,
          ].join(' ')
          const after = [
            `featured=${next.isFeatured ? `L${next.featuredLevel ?? '?'}@${fmtDate(next.featuredUntil)}` : 'off'}`,
            `trending=${next.isTrending ? 'on' : 'off'}`,
          ].join(' ')
          await logBadgeChange(db, {
            modId: mod.id,
            action: 'RECALCULATE',
            oldValue: before,
            newValue: after,
            changedById: user.id,
          })
          logged++
        }
      }

      scanned += mods.length
      cursor = mods[mods.length - 1].id
      if (mods.length < BATCH) break
    }

    return ok({ data: { scanned, updated, logged } })
  } catch (err) {
    console.error('[admin badges recalculate] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to recalculate badges')
  }
}
