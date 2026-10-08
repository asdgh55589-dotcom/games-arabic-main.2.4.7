import type { NextRequest } from 'next/server'
import { notFound, okPaginated, validationFail } from '@/lib/api-response'
import { parsePagination, pickSort, serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { modCardSelect } from '@/lib/prisma-selects'

const SORTS = ['downloads', 'endorsements', 'newest', 'updated', 'views'] as const

const ORDER_BY: Record<string, Record<string, 'desc' | 'asc'>> = {
  downloads: { downloads: 'desc' },
  endorsements: { endorsements: 'desc' },
  newest: { releaseDate: 'desc' },
  updated: { updatedAt: 'desc' },
  views: { views: 'desc' },
}

// GET /api/series/mods?series=<id|slug> — تعديلات سلسلة معينة
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const seriesParam = searchParams.get('series') || ''
  const search = searchParams.get('search')?.trim() || null
  const sort = pickSort(searchParams.get('sort'), SORTS, 'downloads')
  const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
    limit: 24,
    maxLimit: 100,
  })
  const translationType = searchParams.get('translationType')

  if (!seriesParam) {
    return validationFail('series is required')
  }

  // Find series by id or slug
  const series = await db.series.findFirst({
    where: { OR: [{ id: seriesParam }, { slug: seriesParam }] },
    select: { id: true },
  })

  if (!series) {
    return notFound()
  }

  // Public list: DRAFT/IN_REVIEW never enumerable (GAM-8/A1-F1).
  const where: Record<string, unknown> = { seriesId: series.id, workflowStatus: 'PUBLISHED' }
  if (search) {
    where.OR = [{ name: { contains: search } }, { summary: { contains: search } }]
  }
  if (translationType === 'official' || translationType === 'unofficial') {
    where.translationType = translationType
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

  return okPaginated(
    serialize(mods),
    {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  )
}
