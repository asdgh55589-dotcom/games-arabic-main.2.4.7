import type { NextRequest } from 'next/server'
import { internalError, okPaginated } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/badges/log — سجل تغييرات الشارات (الأحدث أولاً)
export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const modId = searchParams.get('modId')?.trim() || null
    const action = searchParams.get('action')?.trim() || null
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 30,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = {}
    if (modId) where.modId = modId
    if (action) where.action = action

    const [total, entries] = await Promise.all([
      db.badgeAuditLog.count({ where }),
      db.badgeAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    // أسماء التعريبات دفعة واحدة
    const modIds = [...new Set(entries.map((e) => e.modId).filter((id) => id !== 'settings'))]
    const mods = modIds.length
      ? await db.mod.findMany({ where: { id: { in: modIds } }, select: { id: true, name: true } })
      : []
    const nameById = new Map(mods.map((m) => [m.id, m.name]))

    return okPaginated(
      entries.map((e) => ({
        id: e.id,
        modId: e.modId,
        modName: nameById.get(e.modId) ?? (e.modId === 'settings' ? 'الإعدادات' : e.modId),
        action: e.action,
        oldValue: e.oldValue,
        newValue: e.newValue,
        changedById: e.changedById,
        createdAt: e.createdAt.toISOString(),
      })),
      {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    )
  } catch (err) {
    console.error('[admin badges log GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('Failed to fetch badge log')
  }
}
