import { internalError, ok } from '@/lib/api-response'
import { serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { getHomeCache, getHomeCacheTtl, setHomeCache } from '@/lib/home-cache'
import type { ModSummary, SeriesSummary } from '@/lib/types'

interface HomeData {
  stats: {
    games: number
    mods: number
    downloads: number
    endorsements: number
    users: number
  }
  featuredGames: unknown[]
  trendingMods: ModSummary[]
  latestMods: ModSummary[]
  topEndorsed: ModSummary[]
  topSeries: SeriesSummary[]
  modsByPlatform: Record<string, ModSummary[]>
}

// Batch queries to avoid connection pool exhaustion (pool size = 5)
async function batchQueries<T>(queries: (() => Promise<T>)[], batchSize: number = 5): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map((q) => q()))
    results.push(...batchResults)
  }
  return results
}

// GET /api/home - aggregated homepage data
//
// Returns everything the home page needs in a single request:
//   - site stats (counts + sums)
//   - featured games (for optional carousel)
//   - trending mods (isTrending=true, sorted by downloads)
//   - latest mods (sorted by updatedAt — most recently updated/new)
//   - top endorsed mods (sorted by endorsements)
//   - top series (by mod count, with first mod as poster)
//   - mods grouped by platform (PC/PS4/PS3/PS2/PS1, 4 each)
//
// Queries are batched (5 at a time) to avoid connection pool exhaustion.
// Results are cached in-memory for 5 minutes.
export async function GET() {
  try {
    // Serve from cache if fresh
    const now = Date.now()
    const cached = getHomeCache()
    const ttl = getHomeCacheTtl()
    if (cached && now - cached.timestamp < ttl) {
      return ok(cached.data as ReturnType<typeof serialize>, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
      })
    }

    const modInclude = {
      author: true,
      game: { select: { name: true, slug: true, platform: true } },
      category: { select: { name: true, slug: true } },
    } as const

    // Fetch active sections dynamically — this drives platform queries
    const activeSections = await db.section.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { key: true },
    })
    const platformKeys =
      activeSections.length > 0
        ? activeSections.map((s) => s.key)
        : (['PC', 'X360', 'NS', 'PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'ANDROID'] as string[])

    // Define all queries as thunks (lazy — not executed until batch runs)
    const queries = [
      // Batch 1: Stats (5 queries)
      () => db.game.count(),
      () => db.mod.count(),
      () => db.mod.aggregate({ _sum: { downloads: true } }),
      () => db.mod.aggregate({ _sum: { endorsements: true } }),
      () => db.user.count(),
      // Batch 2: Featured + Trending + Top Endorsed (3 queries)
      () =>
        db.game.findMany({
          where: { featured: true },
          orderBy: { totalDownloads: 'desc' },
          take: 8,
        }),
      () =>
        db.mod.findMany({
          where: { isTrending: true },
          orderBy: { downloads: 'desc' },
          take: 10,
          include: modInclude,
        }),
      () =>
        db.mod.findMany({
          orderBy: { endorsements: 'desc' },
          take: 10,
          include: modInclude,
        }),
      // Batch 3: Latest mods by platform — dynamic (2 each)
      ...platformKeys.map(
        (platform) => () =>
          db.mod.findMany({
            where: { game: { platform } },
            orderBy: { updatedAt: 'desc' },
            take: 2,
            include: modInclude,
          }),
      ),
      // Batch 4: Platform mods by downloads — dynamic (10 each)
      ...platformKeys.map(
        (platform) => () =>
          db.mod.findMany({
            where: { game: { platform } },
            orderBy: { downloads: 'desc' },
            take: 10,
            include: modInclude,
          }),
      ),
      // Batch 5: Series (1 query)
      () =>
        db.series.findMany({
          orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
          take: 6,
          select: {
            id: true,
            name: true,
            slug: true,
            bannerUrl: true,
            logoUrl: true,
            modCount: true,
            totalDownloads: true,
            totalEndorsements: true,
          },
        }),
    ]

    const results: any[] = await batchQueries(queries as (() => Promise<any>)[], 5)

    // Destructure results by index — dynamic platform count
    const n = platformKeys.length
    const [games, mods, downloadsAgg, endorsementsAgg, users] = results.slice(0, 5)
    const [featuredGames, trendingMods, topEndorsed] = results.slice(5, 8)
    const latestResults = results.slice(8, 8 + n)
    const platformResults = results.slice(8 + n, 8 + n * 2)
    const [topSeriesRaw] = results.slice(8 + n * 2, 8 + n * 2 + 1)

    // ==== بناء latestMods — أحدث 2 من كل منصة، مختلطين بالتساوي ====
    const latestByPlatform: Record<string, (typeof latestResults)[0]> = {}
    platformKeys.forEach((key, idx) => {
      latestByPlatform[key] = latestResults[idx] as (typeof latestResults)[0]
    })
    const latestMods: (typeof latestResults)[0] = []
    for (let round = 0; round < 2; round++) {
      for (const p of platformKeys) {
        const mod = latestByPlatform[p]?.[round]
        if (mod) latestMods.push(mod)
      }
    }

    // السلاسل جاهزة من Series model — نحولها للشكل المتوقع
    const topSeries: SeriesSummary[] = (topSeriesRaw as any[]).map((s) => ({
      name: s.name,
      count: s.modCount,
      downloads: s.totalDownloads,
      endorsements: s.totalEndorsements,
      thumbnailUrl: s.bannerUrl || s.logoUrl || '',
    }))

    const modsByPlatform: Record<string, ModSummary[]> = {}
    platformKeys.forEach((key, idx) => {
      modsByPlatform[key] = (platformResults[idx] as unknown as ModSummary[]) || []
    })

    const responseData = serialize({
      stats: {
        games: games as number,
        mods: mods as number,
        downloads: (downloadsAgg as any)._sum.downloads || 0,
        endorsements: (endorsementsAgg as any)._sum.endorsements || 0,
        users: users as number,
      },
      featuredGames,
      trendingMods: trendingMods as unknown as ModSummary[],
      latestMods: latestMods as unknown as ModSummary[],
      topEndorsed: topEndorsed as unknown as ModSummary[],
      topSeries,
      modsByPlatform,
    }) as HomeData

    // Update cache
    setHomeCache(responseData, now)

    return ok(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    console.error('[api/home] failed:', err)
    return internalError('Failed to load homepage data')
  }
}
