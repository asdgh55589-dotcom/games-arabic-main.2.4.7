import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import { okPaginated, notFound } from '@/lib/api-response'

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
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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

  const where: Record<string, unknown> = { gameId: game.id }
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

  return okPaginated(serialize(mods), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  })
}
