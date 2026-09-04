import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const status = searchParams.get('status')
    const reason = searchParams.get('reason')
    const priority = searchParams.get('priority')
    const targetType = searchParams.get('targetType')
    const sort = searchParams.get('sort') || 'newest'

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (reason) where.reason = reason
    if (priority) where.priority = priority
    if (targetType) where.targetType = targetType

    const orderBy =
      sort === 'oldest'
        ? { createdAt: 'asc' as const }
        : sort === 'priority'
          ? { priority: 'desc' as const }
          : { createdAt: 'desc' as const }

    const [total, stats, reports] = await Promise.all([
      db.report.count({ where }),
      db.report.groupBy({
        by: ['status'],
        _count: true,
        where: {},
      }),
      db.report.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          targetType: true,
          reason: true,
          priority: true,
          status: true,
          description: true,
          createdAt: true,
          reporter: { select: { id: true, username: true, avatarUrl: true } },
          targetMod: { select: { id: true, name: true, slug: true } },
          targetComment: { select: { id: true, text: true } },
          targetUser: { select: { id: true, username: true, avatarUrl: true } },
          assignedTo: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
    ])

    const statsMap: Record<string, number> = {}
    for (const s of stats) {
      statsMap[s.status] = s._count
    }

    return ok({
      reports,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      stats: statsMap,
    })
  } catch (err) {
    console.error('[admin/reports GET] failed:', err)
    return internalError('Failed')
  }
}
