import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseIntParam, clamp } from '@/lib/api-utils'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import type { SearchResponse } from '@/lib/types'

// GET /api/search?q=...&limit=...
// بيدور في التعريبات فقط (مفيش ألعاب)
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'search' })
  if (!rl.success) {
    return NextResponse.json<SearchResponse>(
      { mods: [], games: [] },
      { status: 429, headers: rateLimitHeaders(rl) }
    )
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const limit = clamp(parseIntParam(searchParams.get('limit'), 8), 1, 50)

  if (!q) {
    return NextResponse.json<SearchResponse>({ mods: [], games: [] })
  }

  const mods = await db.mod.findMany({
    where: {
      OR: [
        { name: { contains: q } },
        { summary: { contains: q } },
        { tags: { contains: q } },
        { series: { contains: q } },
        { translationTeam: { contains: q } },
      ],
    },
    take: limit,
    orderBy: { downloads: 'desc' },
    include: {
      author: true,
      game: { select: { name: true, slug: true, platform: true } },
      category: { select: { name: true, slug: true } },
    },
  })

  return NextResponse.json<SearchResponse>({ mods, games: [] })
}
