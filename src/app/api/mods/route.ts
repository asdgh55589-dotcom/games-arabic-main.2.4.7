import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import { okPaginated } from '@/lib/api-response'

const SORTS = ['downloads', 'endorsements', 'newest', 'updated', 'views', 'rating', 'tier'] as const
type Sort = (typeof SORTS)[number]

const ORDER_BY: Record<Exclude<Sort, 'tier'>, Record<string, 'desc' | 'asc'>> = {
  downloads: { downloads: 'desc' },
  endorsements: { endorsements: 'desc' },
  newest: { releaseDate: 'desc' },
  updated: { updatedAt: 'desc' },
  views: { views: 'desc' },
  rating: { rating: 'desc' },
}

const PLATFORM_KEYS = ['PC', 'NS', 'PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'X360', 'ANDROID'] as const

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
  // Whitelist platform — case-insensitive, prevents arbitrary string injection
  const normalizedPlatform = platform ? platform.toUpperCase() : null
  if (normalizedPlatform && (PLATFORM_KEYS as readonly string[]).includes(normalizedPlatform as never)) {
    where.game = { platform: normalizedPlatform }
  }
  // Whitelist translationType — only "official" and "unofficial" are valid.
  if (translationType === 'official' || translationType === 'unofficial') {
    where.translationType = translationType
  }
  if (translationTeam) {
    where.translationTeam = translationTeam
  }

  const minTierParam = searchParams.get('minTier')
  const minTier = minTierParam ? parseInt(minTierParam, 10) : 0
  if (minTier && minTier >= 1 && minTier <= 5) {
    (where as Record<string, unknown>).author = { tier: { gte: minTier } }
  }

  const orderBy = sort === 'tier' ? { author: { tier: 'desc' } } : ORDER_BY[sort as Exclude<Sort, 'tier'>]

  const [total, mods] = await Promise.all([
    db.mod.count({ where }),
    db.mod.findMany({
      where,
      orderBy: orderBy as unknown as Record<string, 'desc' | 'asc'>,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: true,
        game: { select: { name: true, slug: true, platform: true } },
        category: { select: { name: true, slug: true } },
      },
    }),
  ])

  return okPaginated(serialize(mods), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
    },
  })
}
