import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-utils'
import type { HomeData, ApiError, ModSummary, SeriesSummary } from '@/lib/types'

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
// We run all queries in parallel via Promise.all to keep latency low.
export async function GET() {
  try {
    const modInclude = {
      author: true,
      game: { select: { name: true, slug: true, platform: true } },
      category: { select: { name: true, slug: true } },
    } as const

    const [
      games,
      mods,
      downloadsAgg,
      endorsementsAgg,
      users,
      featuredGames,
      trendingMods,
      latestPC,
      latestX360,
      latestNS,
      latestPS4,
      latestPS3,
      latestPS2,
      latestPS1,
      topEndorsed,
      pcMods,
      x360Mods,
      nsMods,
      ps4Mods,
      ps3Mods,
      ps2Mods,
      ps1Mods,
      topSeriesRaw,
    ] = await Promise.all([
      db.game.count(),
      db.mod.count(),
      db.mod.aggregate({ _sum: { downloads: true } }),
      db.mod.aggregate({ _sum: { endorsements: true } }),
      db.user.count(),
      db.game.findMany({
        where: { featured: true },
        orderBy: { totalDownloads: 'desc' },
        take: 8,
      }),
      db.mod.findMany({
        where: { isTrending: true },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      // أحدث تعريب من كل منصة — 2 من كل واحدة (لـ Hero Slider)
      db.mod.findMany({
        where: { game: { platform: 'PC' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'X360' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'NS' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS4' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS3' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS2' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS1' } },
        orderBy: { updatedAt: 'desc' },
        take: 2,
        include: modInclude,
      }),
      db.mod.findMany({
        orderBy: { endorsements: 'desc' },
        take: 10,
        include: modInclude,
      }),
      // تعديلات لكل منصة — 10 بطاقات لكل قسم
      db.mod.findMany({
        where: { game: { platform: 'PC' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'X360' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'NS' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS4' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS3' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS2' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      db.mod.findMany({
        where: { game: { platform: 'PS1' } },
        orderBy: { downloads: 'desc' },
        take: 10,
        include: modInclude,
      }),
      // أعلى 6 سلاسل من Series model
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
    ])

    // ==== بناء latestMods — أحدث 2 من كل منصة، مختلطين بالتساوي ====
    const latestByPlatform: Record<string, typeof latestPC> = {
      PC: latestPC,
      X360: latestX360,
      NS: latestNS,
      PS4: latestPS4,
      PS3: latestPS3,
      PS2: latestPS2,
      PS1: latestPS1,
    }
    const PLATFORMS_ORDER = ['PC', 'X360', 'NS', 'PS4', 'PS3', 'PS2', 'PS1'] as const
    const latestMods: typeof latestPC = []
    for (let round = 0; round < 2; round++) {
      for (const p of PLATFORMS_ORDER) {
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

    const modsByPlatform: Record<string, ModSummary[]> = {
      PC: pcMods as unknown as ModSummary[],
      X360: x360Mods as unknown as ModSummary[],
      NS: nsMods as unknown as ModSummary[],
      PS4: ps4Mods as unknown as ModSummary[],
      PS3: ps3Mods as unknown as ModSummary[],
      PS2: ps2Mods as unknown as ModSummary[],
      PS1: ps1Mods as unknown as ModSummary[],
    }

    return NextResponse.json<HomeData>(serialize({
      stats: {
        games,
        mods,
        downloads: downloadsAgg._sum.downloads || 0,
        endorsements: endorsementsAgg._sum.endorsements || 0,
        users,
      },
      featuredGames,
      trendingMods: trendingMods as unknown as ModSummary[],
      latestMods: latestMods as unknown as ModSummary[],
      topEndorsed: topEndorsed as unknown as ModSummary[],
      topSeries,
      modsByPlatform,
    }), {
      headers: {
        // Home page aggregates many parallel DB queries — cache aggressively to
        // cut DB load. The data includes download/endorse counters that move
        // often, so keep max-age short (30s) but allow stale serving for 120s
        // while a background revalidate fetches fresh data.
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    console.error('[api/home] failed:', err)
    return NextResponse.json<ApiError>(
      { error: 'Failed to load homepage data' },
      { status: 500 }
    )
  }
}
