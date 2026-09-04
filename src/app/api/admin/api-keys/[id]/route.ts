import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, notFound, fail, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

// ===== PATCH /api/admin/api-keys/[id] — تعطيل/تفعيل مفتاح =====

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const { isActive } = body as { isActive?: boolean }

    if (typeof isActive !== 'boolean') {
      return fail('VALIDATION_ERROR', 'isActive must be a boolean', 422)
    }

    // البحث عن المفتاح والتأكد إنه ينتمي للمستخدم
    const existing = await db.apiKey.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return notFound('API key not found')
    }

    const updated = await db.apiKey.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    return ok(updated)
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return fail(
        err instanceof Error ? err.message : 'Unauthorized',
        err instanceof Error ? err.message : 'Unauthorized',
        status,
      )
    }
    console.error('[admin/api-keys/[id] PATCH] failed:', err)
    return internalError('Failed to update API key')
  }
}

// ===== DELETE /api/admin/api-keys/[id] — حذف مفتاح =====

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAdmin()
    const { id } = await params

    const existing = await db.apiKey.findFirst({
      where: { id, userId: user.id },
    })

    if (!existing) {
      return notFound('API key not found')
    }

    await db.apiKey.delete({
      where: { id },
    })

    return ok({ deleted: true })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return fail(
        err instanceof Error ? err.message : 'Unauthorized',
        err instanceof Error ? err.message : 'Unauthorized',
        status,
      )
    }
    console.error('[admin/api-keys/[id] DELETE] failed:', err)
    return internalError('Failed to delete API key')
  }
}
