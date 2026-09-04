import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parseIntParam, clamp, serialize } from '@/lib/api-utils'
import { rateLimit } from '@/lib/rate-limit'
import type { SearchResponse } from '@/lib/types'
import { ok, rateLimited } from '@/lib/api-response'
import { PLATFORM_KEYS } from '@/lib/constants'

// GET /api/search?q=...&platform=PC,PS3&limit=...
// بيدور في التعريبات فقط (مفيش ألعاب)
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'search' })
  if (!rl.success) {
    return rateLimited()
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const platforms = (searchParams.get('platform') || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => PLATFORM_KEYS.includes(p))
  const minTier = clamp(parseIntParam(searchParams.get('minTier'), 0), 0, 5)
  const limit = clamp(parseIntParam(searchParams.get('limit'), 8), 1, 50)

  if (!q && platforms.length === 0 && !minTier) {
    return ok<SearchResponse>({ mods: [], games: [] })
  }

  const mods = await db.mod.findMany({
    where: {
      workflowStatus: 'PUBLISHED',
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { summary: { contains: q } },
              { tags: { contains: q } },
              { series: { contains: q } },
              { translationTeam: { contains: q } },
            ],
          }
        : {}),
      ...(platforms.length > 0 ? { game: { platform: { in: platforms } } } : {}),
      ...(minTier ? { author: { tier: { gte: minTier } } } : {}),
    },
    take: limit,
    orderBy: { downloads: 'desc' },
    include: {
      author: true,
      game: { select: { name: true, slug: true, platform: true } },
      category: { select: { name: true, slug: true } },
    },
  })

  return ok<SearchResponse>({ mods: serialize(mods), games: [] })
}
