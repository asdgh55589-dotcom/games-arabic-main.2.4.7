import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { parseFilterParam, RequestStatusFilterSchema } from '@/lib/creator-query'

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return error!

    const limited = await rateLimitMiddleware(req, {
      limit: 60,
      window: 60,
      keyPrefix: `creator:requests:${user.id}`,
    })
    if (limited) return limited

    const { searchParams } = new URL(req.url)
    // E4 — central Zod whitelist. Free strings never reach Prisma.
    const statusParsed = parseFilterParam(searchParams, 'status', RequestStatusFilterSchema, 'all')
    if (!statusParsed.ok) {
      return validationFail('الحالة غير صالحة')
    }
    const status = statusParsed.value
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20))

    const where: Record<string, unknown> = {}
    if (status === 'all') {
      // Marketplace view — never expose closed/rejected requests.
      ;(where as Record<string, unknown>).status = { notIn: ['cancelled', 'rejected'] }
    } else if (status === 'mine') {
      ;(where as Record<string, unknown>).acceptedBy = user.id
    } else if (status === 'cancelled' || status === 'rejected') {
      // Closed requests are visible only to their requester or assignee.
      ;(where as Record<string, unknown>).status = status
      ;(where as Record<string, unknown>).OR = [{ userId: user.id }, { acceptedBy: user.id }]
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
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    logger.error('[creator/requests GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/requests' })
    return internalError('فشل جلب الطلبات')
  }
}
