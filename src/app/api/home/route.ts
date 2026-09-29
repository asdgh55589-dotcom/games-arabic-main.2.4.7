import { internalError, ok } from '@/lib/api-response'
import { serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { getHomeCache, getHomeCacheTtl, setHomeCache } from '@/lib/home-cache'
import { modCardSelect } from '@/lib/prisma-selects'
import type { ModSummary, SeriesSummary } from '@/lib/types'
import { Prisma } from '@prisma/client'

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

/**
 * One raw-SQL row of the per-platform lateral queries below.
 * Column names are the quoted aliases (Prisma maps them verbatim).
 */
interface PlatformModRow {
  platform_key: string
  id: string
  slug: string
  name: string
  headline: string
  summary: string
  thumbnailUrl: string
  imageUrl: string
  galleryUrls: string
  version: string
  fileSize: string
  fileFormat: string
  downloads: number
  endorsements: number
  views: number
  comments: number
  rating: number
  ratingCount: number
  tags: string
  series: string
  translationTeam: string
  translationType: string
  isOriginalWork: boolean
  originalSource: string | null
  originalAuthor: string | null
  isFeatured: boolean
  isTrending: boolean
  isLatest: boolean
  featuredLevel: number | null
  featuredUntil: Date | null
  trendingUntil: Date | null
  popularUntil: Date | null
  hiddenBadges: string
  scheduledAt: Date | null
  workflowStatus: string
  releaseDate: Date
  updatedAt: Date
  createdAt: Date
  author_id: string
  author_username: string
  author_displayName: string | null
  author_avatarUrl: string | null
  author_bannerUrl: string | null
  author_bio: string | null
  author_role: string
  author_tier: number
  author_specialRoles: string
  author_qualityScore: number
  author_joinedAt: Date
  game_name: string
  game_slug: string
  game_platform: string
  category_id: string | null
  category_name: string | null
  category_slug: string | null
}

/** Shared column list for the lateral per-platform queries (explicit — no SELECT *). */
const PLATFORM_MOD_COLUMNS = `
  m."id", m."slug", m."name", m."headline", m."summary",
  m."thumbnailUrl", m."imageUrl", m."galleryUrls", m."version",
  m."fileSize", m."fileFormat", m."downloads", m."endorsements",
  m."views", m."comments", m."rating", m."ratingCount", m."tags",
  m."series", m."translationTeam", m."translationType",
  m."isOriginalWork", m."originalSource", m."originalAuthor",
  m."isFeatured", m."isTrending", m."isLatest",
  m."featuredLevel", m."featuredUntil", m."trendingUntil", m."popularUntil",
  m."hiddenBadges", m."scheduledAt", m."workflowStatus",
  m."releaseDate", m."updatedAt", m."createdAt",
  u."id" AS "author_id", u."username" AS "author_username",
  u."displayName" AS "author_displayName", u."avatarUrl" AS "author_avatarUrl",
  u."bannerUrl" AS "author_bannerUrl", u."bio" AS "author_bio",
  u."role" AS "author_role", u."tier" AS "author_tier",
  u."specialRoles" AS "author_specialRoles", u."qualityScore" AS "author_qualityScore",
  u."joinedAt" AS "author_joinedAt",
  g."name" AS "game_name", g."slug" AS "game_slug", g."platform" AS "game_platform",
  c."id" AS "category_id", c."name" AS "category_name", c."slug" AS "category_slug"
`

function toModSummary(r: PlatformModRow): ModSummary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    headline: r.headline,
    summary: r.summary,
    thumbnailUrl: r.thumbnailUrl,
    imageUrl: r.imageUrl,
    galleryUrls: r.galleryUrls,
    version: r.version,
    fileSize: r.fileSize,
    fileFormat: r.fileFormat,
    downloads: Number(r.downloads),
    endorsements: Number(r.endorsements),
    views: Number(r.views),
    comments: Number(r.comments),
    rating: Number(r.rating),
    ratingCount: Number(r.ratingCount),
    tags: r.tags,
    series: r.series,
    translationTeam: r.translationTeam,
    translationType: r.translationType,
    isOriginalWork: r.isOriginalWork,
    originalSource: r.originalSource,
    originalAuthor: r.originalAuthor,
    isFeatured: r.isFeatured,
    isTrending: r.isTrending,
    isLatest: r.isLatest,
    featuredLevel: r.featuredLevel,
    featuredUntil: r.featuredUntil,
    trendingUntil: r.trendingUntil,
    popularUntil: r.popularUntil,
    hiddenBadges: r.hiddenBadges,
    scheduledAt: r.scheduledAt,
    workflowStatus: r.workflowStatus,
    releaseDate: r.releaseDate,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
    author: {
      id: r.author_id,
      username: r.author_username,
      avatarUrl: r.author_avatarUrl,
      bannerUrl: r.author_bannerUrl,
      bio: r.author_bio,
      role: r.author_role,
      tier: Number(r.author_tier),
      specialRoles: r.author_specialRoles,
      qualityScore: Number(r.author_qualityScore),
      joinedAt: r.author_joinedAt,
    },
    game: { name: r.game_name, slug: r.game_slug, platform: r.game_platform },
    category:
      r.category_id && r.category_name && r.category_slug
        ? { id: r.category_id, name: r.category_name, slug: r.category_slug }
        : null,
  }
}

// GET /api/home - aggregated homepage data
//
// Returns everything the home page needs in a single request.
// Exactly 8 sequential queries (pool never holds >1 connection):
//   1. active sections · 2. site stats (single aggregation) · 3. featured games
//   4. trending mods · 5. top endorsed · 6. latest 2 per platform (lateral join)
//   7. top 10 per platform (lateral join) · 8. top series
// Results are cached shared (Redis, 300s) — repeat hits cost zero queries.
export async function GET() {
  try {
    // Serve from shared cache if fresh
    const now = Date.now()
    const cached = await getHomeCache()
    const ttl = getHomeCacheTtl()
    if (cached && now - cached.timestamp < ttl) {
      return ok(cached.data as ReturnType<typeof serialize>, {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
      })
    }

    // 1. Active sections drive the platform queries
    const activeSections = await db.section.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { key: true },
    })
    const platformKeys =
      activeSections.length > 0
        ? activeSections.map((s) => s.key)
        : (['PC', 'X360', 'NS', 'PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'ANDROID'] as string[])

    // 2. Site stats — single aggregation round-trip (was 5 separate queries)
    const [stats] = await db.$queryRaw<
      Array<{ games: number; mods: number; downloads: number; endorsements: number; users: number }>
    >`
      SELECT
        (SELECT COUNT(*) FROM "Game")::int AS games,
        (SELECT COUNT(*) FROM "Mod")::int AS mods,
        COALESCE((SELECT SUM("downloads") FROM "Mod"), 0)::int AS downloads,
        COALESCE((SELECT SUM("endorsements") FROM "Mod"), 0)::int AS endorsements,
        (SELECT COUNT(*) FROM "User")::int AS users
    `

    // 3-5. Featured games, trending, top endorsed (same predicates as before)
    const featuredGames = await db.game.findMany({
      where: { featured: true },
      orderBy: { totalDownloads: 'desc' },
      take: 8,
    })
    const trendingMods = await db.mod.findMany({
      where: { isTrending: true },
      orderBy: { downloads: 'desc' },
      take: 10,
      select: modCardSelect,
    })
    const topEndorsed = await db.mod.findMany({
      orderBy: { endorsements: 'desc' },
      take: 10,
      select: modCardSelect,
    })

    // 6. Latest 2 mods per active platform — ONE lateral-join query (was N queries)
    const latestRows = await db.$queryRaw<PlatformModRow[]>`
      SELECT s."key" AS "platform_key", ${Prisma.raw(PLATFORM_MOD_COLUMNS)}
      FROM "Section" s
      CROSS JOIN LATERAL (
        SELECT m.* FROM "Mod" m
        JOIN "Game" g2 ON g2."id" = m."gameId"
        WHERE g2."platform" = s."key"
        ORDER BY m."updatedAt" DESC
        LIMIT 2
      ) m
      JOIN "User" u ON u."id" = m."authorId"
      JOIN "Game" g ON g."id" = m."gameId"
      LEFT JOIN "Category" c ON c."id" = m."categoryId"
      WHERE s."isActive" = true
      ORDER BY s."order" ASC, m."updatedAt" DESC
    `

    // 7. Top 10 mods per active platform — ONE lateral-join query (was N queries)
    const platformRows = await db.$queryRaw<PlatformModRow[]>`
      SELECT s."key" AS "platform_key", ${Prisma.raw(PLATFORM_MOD_COLUMNS)}
      FROM "Section" s
      CROSS JOIN LATERAL (
        SELECT m.* FROM "Mod" m
        JOIN "Game" g2 ON g2."id" = m."gameId"
        WHERE g2."platform" = s."key"
        ORDER BY m."downloads" DESC
        LIMIT 10
      ) m
      JOIN "User" u ON u."id" = m."authorId"
      JOIN "Game" g ON g."id" = m."gameId"
      LEFT JOIN "Category" c ON c."id" = m."categoryId"
      WHERE s."isActive" = true
      ORDER BY s."order" ASC, m."downloads" DESC
    `

    // 8. Top series
    const topSeriesRaw = await db.series.findMany({
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
    })

    // ==== Group lateral rows back per platform ====
    const latestByPlatform: Record<string, ModSummary[]> = {}
    const modsByPlatform: Record<string, ModSummary[]> = {}
    for (const key of platformKeys) {
      latestByPlatform[key] = []
      modsByPlatform[key] = []
    }
    for (const row of latestRows) {
      if (latestByPlatform[row.platform_key]) latestByPlatform[row.platform_key].push(toModSummary(row))
    }
    for (const row of platformRows) {
      if (modsByPlatform[row.platform_key]) modsByPlatform[row.platform_key].push(toModSummary(row))
    }

    // ==== بناء latestMods — أحدث 2 من كل منصة، مختلطين بالتساوي ====
    const latestMods: ModSummary[] = []
    for (let round = 0; round < 2; round++) {
      for (const p of platformKeys) {
        const mod = latestByPlatform[p]?.[round]
        if (mod) latestMods.push(mod)
      }
    }

    // السلاسل جاهزة من Series model — نحولها للشكل المتوقع
    const topSeries: SeriesSummary[] = topSeriesRaw.map((s) => ({
      name: s.name,
      count: s.modCount,
      downloads: s.totalDownloads,
      endorsements: s.totalEndorsements,
      thumbnailUrl: s.bannerUrl || s.logoUrl || '',
    }))

    const responseData = serialize({
      stats: {
        games: Number(stats.games),
        mods: Number(stats.mods),
        downloads: Number(stats.downloads),
        endorsements: Number(stats.endorsements),
        users: Number(stats.users),
      },
      featuredGames,
      trendingMods: trendingMods as unknown as ModSummary[],
      latestMods,
      topEndorsed: topEndorsed as unknown as ModSummary[],
      topSeries,
      modsByPlatform,
    }) as HomeData

    // Update shared cache (fail-open — a cache write failure must not fail the request)
    await setHomeCache(responseData, now).catch(() => {})

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
