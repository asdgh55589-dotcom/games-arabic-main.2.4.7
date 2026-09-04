import type { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
  const skip = (page - 1) * limit

  const filter = searchParams.get('filter') || 'all' // all | visible | hidden

  const where: Record<string, unknown> = {
    mod: { authorId: user.id },
  }

  if (filter === 'visible') {
    ;(where as Record<string, unknown>).isHidden = false
  } else if (filter === 'hidden') {
    ;(where as Record<string, unknown>).isHidden = true
  }

  const [comments, total] = await Promise.all([
    db.modComment.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true, role: true } },
        mod: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.modComment.count({
      where,
    }),
  ])

  return ok({
    comments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  })
}
