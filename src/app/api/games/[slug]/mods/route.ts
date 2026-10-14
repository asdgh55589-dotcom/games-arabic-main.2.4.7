import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { getApiVersion, setApiVersionHeader } from '@/lib/api-versioning'
import { notFound } from '@/lib/api-response'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import {
  buildGameModsCacheKey,
  type GameModsListPayload,
  getGameModsCache,
  getGameModsCacheVersion,
  setGameModsCache,
} from '@/lib/game-mods-cache'
import { modCardSelect } from '@/lib/prisma-selects'
import { withRequestLogger } from '@/lib/request-logger'

const SORTS = ['downloads', 'endorsements', 'newest', 'updated', 'views', 'rating'] as const
type Sort = (typeof SORTS)[number]

const ORDER_BY: Record<Sort, Record<string, 'desc' | 'asc'>> = {
  downloads: { downloads: 'desc' },
  endorsements: { endorsements: 'desc' },
  newest: { releaseDate: 'desc' },
  updated: { updatedAt: 'desc' },
  views: { views: 'desc' },
  rating: { rating: 'desc' },
}

// GET /api/games/[slug]/mods - list mods for a game
export const GET = withRequestLogger(
  async (req: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')?.trim() || null
    const sort = pickSort(searchParams.get('sort'), SORTS, 'downloads')
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 24,
      maxLimit: 100,
    })
    const featured = searchParams.get('featured')

    const game = await db.game.findUnique({ where: { slug } })
    if (!game) {
      return notFound('Game not found')
    }

    // Public list: DRAFT/IN_REVIEW never enumerable (GAM-8/A1-F1).
    const where: Record<string, unknown> = { gameId: game.id, workflowStatus: 'PUBLISHED' }
    if (category) {
      where.category = { slug: category }
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { summary: { contains: search } },
        { tags: { contains: search } },
      ]
    }
    if (featured === 'true') where.isFeatured = true

    // Server-side result cache (fail-open): version null → bypass entirely.
    const cacheVersion = await getGameModsCacheVersion(game.id)
    const cacheKey =
      cacheVersion === null
        ? null
        : buildGameModsCacheKey({
            gameId: game.id,
            version: cacheVersion,
            page,
            limit,
            sort,
            category,
            search,
            featured,
          })
    if (cacheKey) {
      const cached = await getGameModsCache(cacheKey)
      if (cached) {
        const headers = new Headers()
        setCacheControl(headers, { type: 'public', maxAge: 30, swr: 120 })
        const res = await withETag(req, cached, { headers })
        return setApiVersionHeader(res, getApiVersion(req))
      }
    }

    const [total, mods] = await Promise.all([
      db.mod.count({ where }),
      db.mod.findMany({
        where,
        orderBy: ORDER_BY[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: modCardSelect,
      }),
    ])

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }
    const payload: GameModsListPayload = { data: serialize(mods), pagination }
    // Best-effort store — never blocks or fails the response.
    if (cacheKey) setGameModsCache(cacheKey, payload).catch(() => {})
    // Same cache policy as GET /api/mods: 30s fresh + 120s stale + ETag/304
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 30, swr: 120 })
    const res = await withETag(req, payload, { headers })
    return setApiVersionHeader(res, getApiVersion(req))
  },
  'GET /api/games/[slug]/mods',
)
