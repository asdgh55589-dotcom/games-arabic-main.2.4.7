import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { okPaginated, internalError } from '@/lib/api-response'

// GET /api/admin/audit — سجل النشاطات
export async function GET(req: NextRequest) {
  try {
    await requireOwner()
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const action = searchParams.get('action')
    const entity = searchParams.get('entity')
    const userId = searchParams.get('userId')

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (entity) where.entity = entity
    if (userId) where.userId = userId

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return okPaginated({ logs }, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 })
  } catch (err) {
    console.error('[admin/audit GET] failed:', err)
    return internalError('Failed')
  }
}
