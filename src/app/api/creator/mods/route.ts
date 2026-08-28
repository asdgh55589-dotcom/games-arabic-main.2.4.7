import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q = searchParams.get('q')?.trim() || ''
  const sort = searchParams.get('sort') || 'createdAt'
  const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

  const where: Record<string, unknown> = { authorId: user.id }

  if (status && status !== 'all') {
    ;(where as Record<string, unknown>).workflowStatus = status
  }

  if (q) {
    ;(where as Record<string, unknown>).name = { contains: q, mode: 'insensitive' }
  }

  const total = await db.mod.count({ where })

  // Validate sort field to prevent injection
  const allowedSorts = ['createdAt', 'updatedAt', 'downloads', 'views', 'rating', 'name']
  const sortField = allowedSorts.includes(sort) ? sort : 'createdAt'

  const mods = await db.mod.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      workflowStatus: true,
      views: true,
      downloads: true,
      endorsements: true,
      rating: true,
      ratingCount: true,
      comments: true,
      createdAt: true,
      updatedAt: true,
      isOriginalWork: true,
      originalSource: true,
      thumbnailUrl: true,
      game: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { [sortField]: order },
    skip: (page - 1) * limit,
    take: limit,
  })

  return ok({
    mods,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  })
}
