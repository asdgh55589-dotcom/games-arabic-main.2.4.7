import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import type { PaginatedMods } from '@/lib/types'

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

const PLATFORM_KEYS = ['PC', 'NS', 'PS1', 'PS2', 'PS3', 'PS4'] as const

// GET /api/mods - list mods across all games, with filters
//
// Supported query params:
//   - search: free-text search across name/summary/tags
//   - sort: downloads | endorsements | newest | updated | views | rating
//   - page, limit: pagination
//   - featured, trending, latest: boolean flags ("true" to filter)
//   - platform: PC | PS1 | PS2 | PS3 | PS4 — filters mods whose game is on that platform
//   - translationType: official | unofficial — filters mods by translation type
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim() || null
  const sort = pickSort(searchParams.get('sort'), SORTS, 'downloads')
  const { page, limit } = parsePagination(
    searchParams.get('page'),
    searchParams.get('limit'),
    { limit: 24, maxLimit: 100 }
  )

  const featured = searchParams.get('featured')
  const trending = searchParams.get('trending')
  const latest = searchParams.get('latest')
  const platform = searchParams.get('platform')
  const translationType = searchParams.get('translationType')
  const translationTeam = searchParams.get('translationTeam')?.trim() || null

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { summary: { contains: search } },
      { tags: { contains: search } },
    ]
  }
  if (featured === 'true') where.isFeatured = true
  if (trending === 'true') where.isTrending = true
  if (latest === 'true') where.isLatest = true
  // Whitelist platform — prevents arbitrary string injection into the query.
  if (platform && (PLATFORM_KEYS as readonly string[]).includes(platform)) {
    where.game = { platform }
  }
  // Whitelist translationType — only "official" and "unofficial" are valid.
  if (translationType === 'official' || translationType === 'unofficial') {
    where.translationType = translationType
  }
  if (translationTeam) {
    where.translationTeam = translationTeam
  }

  const [total, mods] = await Promise.all([
    db.mod.count({ where }),
    db.mod.findMany({
      where,
      orderBy: ORDER_BY[sort],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: true,
        game: { select: { name: true, slug: true, platform: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
  ])

  return NextResponse.json<PaginatedMods>({
    mods: serialize(mods),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
    },
  })
}
