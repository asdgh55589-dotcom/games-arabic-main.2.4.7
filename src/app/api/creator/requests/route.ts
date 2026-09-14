import type { NextRequest } from 'next/server'
import { internalError, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return error!

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20))

    const where: Record<string, unknown> = {}
    if (status === 'all') {
      // no filter — show all
    } else if (status === 'mine') {
      ;(where as Record<string, unknown>).acceptedBy = user.id
    } else {
      ;(where as Record<string, unknown>).status = status
    }

    const [requests, total] = await Promise.all([
      db.modRequest.findMany({
        where: where as never,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          mod: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ interestCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.modRequest.count({ where: where as never }),
    ])

    return ok({
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    })
  } catch (err) {
    console.error('[creator/requests GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/requests' })
    return internalError('فشل جلب الطلبات')
  }
}
