import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireModerator } from '@/lib/auth'
import {
  calculateBadges,
  getBadgeSettings,
  type BadgeResult,
} from '@/lib/badges'
import { db } from '@/lib/db'

export interface ModBadgeRow {
  id: string
  slug: string
  name: string
  thumbnailUrl: string
  downloads: number
  downloadsLast24h: number
  createdAt: string
  updatedAt: string
  featuredLevel: number | null
  featuredUntil: string | null
  trendingUntil: string | null
  popularUntil: string | null
  hiddenBadges: string
  badges: BadgeResult
}

// GET /api/admin/badges — كل التعريبات مع شاراتها الحالية + فلترة + بحث
export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || null
    const badge = searchParams.get('badge') || null // featured|trending|popular|new|updated|none
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 24,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [{ name: { contains: search } }, { slug: { contains: search } }]
    }
    const now = new Date()
    if (badge === 'featured') {
      where.featuredUntil = { gt: now }
    } else if (badge === 'trending') {
      where.trendingUntil = { gt: now }
    } else if (badge === 'popular') {
      where.popularUntil = { gt: now }
    }

    const [total, mods] = await Promise.all([
      db.mod.count({ where }),
      db.mod.findMany({
        where,
        orderBy: { downloads: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          thumbnailUrl: true,
          downloads: true,
          createdAt: true,
          updatedAt: true,
          featuredLevel: true,
          featuredUntil: true,
          trendingUntil: true,
          popularUntil: true,
          hiddenBadges: true,
        },
      }),
    ])

    // عدّادات 24 ساعة دفعة واحدة (بدون N+1)
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const counts = await db.downloadClick.groupBy({
      by: ['modId'],
      where: { modId: { in: mods.map((m) => m.id) }, createdAt: { gte: since } },
      _count: { modId: true },
    })
    const countByMod = new Map(counts.map((c) => [c.modId, c._count.modId]))

    const settings = await getBadgeSettings(db)

    let rows: ModBadgeRow[] = mods.map((m) => {
      const downloadsLast24h = countByMod.get(m.id) ?? 0
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        thumbnailUrl: m.thumbnailUrl,
        downloads: m.downloads,
        downloadsLast24h,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
        featuredLevel: m.featuredLevel,
        featuredUntil: m.featuredUntil?.toISOString() ?? null,
        trendingUntil: m.trendingUntil?.toISOString() ?? null,
        popularUntil: m.popularUntil?.toISOString() ?? null,
        hiddenBadges: m.hiddenBadges,
        badges: calculateBadges(m, downloadsLast24h, settings, now),
      }
    })

    // فلترة new/updated/none تُحسب بعد الحساب (تعتمد على الوقت)
    if (badge === 'new') rows = rows.filter((r) => r.badges.time === 'new')
    else if (badge === 'updated') rows = rows.filter((r) => r.badges.time === 'updated')
    else if (badge === 'none')
      rows = rows.filter((r) => !r.badges.performance && !r.badges.time)

    return okPaginated(rows, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin badges GET] failed:', err)
    return internalError('Failed to list badges')
  }
}
