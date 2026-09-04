import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/endorsements — قائمة كل التأييدات
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const modId = searchParams.get('modId')

    const where: Record<string, unknown> = {}
    if (modId) where.modId = modId

    const [total, endorsements] = await Promise.all([
      db.endorsement.count({ where }),
      db.endorsement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          mod: { select: { id: true, name: true, slug: true } },
        },
      }),
    ])

    // إحصائيات (مفلترة حسب modId لو موجود)
    const statsWhere = modId ? { modId } : {}
    const [upCount, downCount, topMods] = await Promise.all([
      db.endorsement.count({ where: { ...statsWhere, value: 'up' } }),
      db.endorsement.count({ where: { ...statsWhere, value: 'down' } }),
      db.mod.findMany({
        orderBy: { endorsements: 'desc' },
        take: 10,
        select: { id: true, name: true, slug: true, endorsements: true },
      }),
    ])

    return okPaginated(
      {
        endorsements,
        stats: { up: upCount, down: downCount, total: upCount + downCount },
        topMods,
      },
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    )
  } catch (err) {
    console.error('[admin/endorsements GET] failed:', err)
    return internalError('Failed')
  }
}
