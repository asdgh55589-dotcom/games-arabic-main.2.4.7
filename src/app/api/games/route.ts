import type { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { pickSort, serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'

const SORTS = ['popular', 'mods', 'name', 'newest'] as const
type Sort = (typeof SORTS)[number]

const ORDER_BY: Record<Sort, Record<string, 'desc' | 'asc'>> = {
  popular: { totalDownloads: 'desc' },
  mods: { modCount: 'desc' },
  name: { name: 'asc' },
  newest: { createdAt: 'desc' },
}

// GET /api/games - list games, optionally filtered
//
// This endpoint is fetched on every page load (for the navbar dropdown) and
// the data changes rarely, so we cache it for 60 seconds in the browser.
// The `stale-while-revalidate` directive lets the browser serve a cached
// response immediately while fetching a fresh one in the background.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const featured = searchParams.get('featured')
  const category = searchParams.get('category')
  const platform = searchParams.get('platform')
  const search = searchParams.get('search')?.trim() || null
  const sort = pickSort(searchParams.get('sort'), SORTS, 'popular')

  const where: Record<string, unknown> = {}
  if (featured === 'true') where.featured = true
  if (category) where.category = category
  if (platform) where.platform = platform
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { tagline: { contains: search } },
      { description: { contains: search } },
    ]
  }

  const games = await db.game.findMany({
    where,
    orderBy: ORDER_BY[sort],
    include: { _count: { select: { mods: true } } },
  })

  return ok(serialize(games), {
    headers: {
      // Cache for 60s in the browser, serve stale for up to 300s while revalidating.
      // Only apply to non-filtered lists (search/featured/category queries are
      // less cache-friendly since they vary by query string — but the browser
      // keys cache by full URL anyway, so this is safe).
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  })
}
