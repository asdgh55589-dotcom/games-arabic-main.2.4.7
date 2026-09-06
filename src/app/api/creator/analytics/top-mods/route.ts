import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

const RANGES = new Set([7, 30, 90])

const PRIVATE_NO_STORE = {
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
} as const

// GET /api/creator/analytics/top-mods?range=30&limit=10 — top mods by
// PERIOD downloads (server aggregate for the dashboard table shell).
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { searchParams } = new URL(req.url)
    const days = Number.parseInt(searchParams.get('range') || '30', 10)
    const limit = Math.min(25, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10)))
    if (!RANGES.has(days)) {
      return validationFail('النطاق يجب أن يكون 7 أو 30 أو 90 يوماً')
    }

    const limited = await rateLimitMiddleware(req, {
      limit: 30,
      window: 60,
      keyPrefix: `creator:analytics:${user.id}`,
    })
    if (limited) return limited

    const start = new Date(Date.now() - days * 86400000)
    const ownMods = await db.mod.findMany({ where: { authorId: user.id }, select: { id: true } })
    const ownIds = ownMods.length > 0 ? ownMods.map((m) => m.id) : ['__none__']

    const [dlGroups, viewGroups] = await Promise.all([
      db.downloadClick.groupBy({
        by: ['modId'],
        where: { modId: { in: ownIds }, createdAt: { gte: start } },
        _count: { _all: true },
        orderBy: { _count: { modId: 'desc' } },
        take: limit,
      }),
      db.modView.groupBy({
        by: ['modId'],
        where: { modId: { in: ownIds }, viewedAt: { gte: start } },
        _count: { _all: true },
      }),
    ])

    const viewsByMod = new Map(viewGroups.map((g) => [g.modId, g._count._all]))
    const mods = await db.mod.findMany({
      where: { id: { in: dlGroups.map((g) => g.modId) } },
      select: { id: true, name: true, slug: true, workflowStatus: true, game: { select: { name: true } } },
    })
    const modById = new Map(mods.map((m) => [m.id, m]))

    const rows = dlGroups.map((g) => {
      const m = modById.get(g.modId)
      return {
        modId: g.modId,
        name: m?.name ?? '—',
        slug: m?.slug ?? '',
        game: m?.game?.name ?? '—',
        workflowStatus: m?.workflowStatus ?? 'DRAFT',
        downloads: g._count._all,
        views: viewsByMod.get(g.modId) ?? 0,
      }
    })

    return ok({ range: days, mods: rows }, PRIVATE_NO_STORE)
  } catch (err) {
    console.error('[creator/analytics/top-mods GET] failed:', err)
    return internalError('فشل جلب الأعلى تحميلاً')
  }
}
