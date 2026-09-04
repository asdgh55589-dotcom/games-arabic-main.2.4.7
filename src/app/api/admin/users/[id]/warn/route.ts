import type { NextRequest } from 'next/server'
import { fail, internalError, ok } from '@/lib/api-response'
import { logUserAction } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// POST /api/admin/users/[id]/warn — تحذير مستخدم
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    // تحقق من وجود المستخدم
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true },
    })
    if (!targetUser) {
      return fail('NOT_FOUND', 'المستخدم غير موجود', 404)
    }
    // منع تحذير المالك
    if (targetUser.role === 'owner') {
      return fail('FORBIDDEN', 'لا يمكن تحذير المالك', 403)
    }
    // منع تحذير النفس
    if (targetUser.id === currentUser.id) {
      return fail('FORBIDDEN', 'لا يمكن تحذير نفسك', 403)
    }

    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason || reason.length < 5) {
      return fail('VALIDATION_ERROR', 'سبب التحذير مطلوب (5 أحرف على الأقل)', 400)
    }

    await logUserAction({
      userId: targetUser.id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'warn',
      reason,
      request: req,
    })

    // إنشاء إشعار للمستخدم (اختياري — لا يفشل الطلب)
    try {
      await db.notification.create({
        data: {
          userId: targetUser.id,
          actorId: currentUser.id,
          type: 'warning',
          title: 'تحذير إداري',
          message: reason,
        },
      })
    } catch {}

    return ok({ success: true })
  } catch (err) {
    const status = (err as any)?.status
    if (status === 401 || status === 403) return fail('FORBIDDEN', (err as Error).message, status)
    console.error('[admin/users/[id]/warn] failed:', err)
    return internalError('Failed')
  }
}
