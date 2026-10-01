import type { NextRequest } from 'next/server'
import { setCacheControl, withETag } from '@/lib/api-cache'
import { getApiVersion, setApiVersionHeader } from '@/lib/api-versioning'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { addHateoasLinks, shouldIncludeLinks } from '@/lib/hateoas'
import { modCardSelect } from '@/lib/prisma-selects'
import { parseSparseFields } from '@/lib/sparse-fieldsets'

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

// Phase 4: sparse fieldset allowlist (scalar card fields; relations stay full).
const MOD_SPARSE_ALLOWLIST = [
  'id', 'slug', 'name', 'headline', 'summary', 'thumbnailUrl', 'imageUrl',
  'galleryUrls', 'version', 'fileSize', 'fileFormat', 'downloads', 'endorsements',
  'views', 'comments', 'rating', 'ratingCount', 'tags', 'series', 'translationTeam',
  'translationType', 'isOriginalWork', 'originalSource', 'originalAuthor',
  'isFeatured', 'isTrending', 'isLatest', 'featuredLevel', 'featuredUntil',
  'trendingUntil', 'popularUntil', 'hiddenBadges', 'scheduledAt', 'workflowStatus',
  'releaseDate', 'updatedAt', 'createdAt',
] as const

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
  const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
    limit: 24,
    maxLimit: 100,
  })

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
  if (
    normalizedPlatform &&
    (PLATFORM_KEYS as readonly string[]).includes(normalizedPlatform as never)
  ) {
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
    ;(where as Record<string, unknown>).author = { tier: { gte: minTier } }
  }

  const orderBy =
    sort === 'tier' ? { author: { tier: 'desc' } } : ORDER_BY[sort as Exclude<Sort, 'tier'>]

  // Phase 4 (opt-in): ?fields= → Prisma select (absent/invalid = full card, unchanged).
  const sparse = parseSparseFields(searchParams.get('fields'), MOD_SPARSE_ALLOWLIST)

  const [total, mods] = await Promise.all([
    db.mod.count({ where }),
    db.mod.findMany({
      where,
      orderBy: orderBy as unknown as Record<string, 'desc' | 'asc'>,
      skip: (page - 1) * limit,
      take: limit,
      select: (sparse ?? modCardSelect) as typeof modCardSelect,
    }),
  ])

  let items: unknown[] = serialize(mods)
  // Phase 4 (opt-in): HATEOAS via Accept: application/hal+json or ?_links=true.
  if (shouldIncludeLinks(req, searchParams)) {
    const origin = new URL(req.url).origin
    items = items.map((m) =>
      addHateoasLinks(m as { id: string; [key: string]: unknown }, 'mod', origin),
    )
  }
  const pagination = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  }
  // Phase 3: ETag + Vary (TTL preserved: 30s fresh, 120s stale)
  const headers = new Headers()
  setCacheControl(headers, { type: 'public', maxAge: 30, swr: 120 })
  const res = await withETag(req, { data: items, pagination }, { headers })
  // Phase 4: version stamp (v1 default — payload identical across versions for now)
  return setApiVersionHeader(res, getApiVersion(req))
}
