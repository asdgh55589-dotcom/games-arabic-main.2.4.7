import type { NextRequest } from 'next/server'
import {
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

function getStatusAr(status: string): string {
  const map: Record<string, string> = {
    open: 'مفتوح',
    accepted: 'مقبول',
    completed: 'مكتمل',
    cancelled: 'ملغي',
  }
  return map[status] || status
}

// PATCH /api/admin/mod-requests/[id] — تحديث حالة طلب تعريب
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireModerator()
    const { id } = await params

    const request = await db.modRequest.findUnique({ where: { id } })
    if (!request) return notFound('الطلب غير موجود')

    const body = await req.json()
    const { status, reason } = body as { status?: string; reason?: string }

    if (!status || !['open', 'accepted', 'completed', 'cancelled'].includes(status)) {
      return validationFail('حالة غير صالحة')
    }

    await db.modRequest.update({
      where: { id },
      data: { status },
    })

    // سجل النشاط (اختياري)
    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: admin.id,
        username: admin.username || 'admin',
        action: 'MOD_REQUEST_STATUS_CHANGED',
        entity: 'ModRequest',
        entityId: id,
        details: JSON.stringify({ from: request.status, to: status, reason }),
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification
    }

    // إشعار الطالب
    try {
      await db.notification.create({
        data: {
          userId: request.userId,
          actorId: admin.id,
          type: 'system_announcement',
          title:
            status === 'cancelled'
              ? '❌ تم إغلاق طلبك'
              : status === 'completed'
                ? '✅ تم إكمال طلبك'
                : 'ℹ️ تحديث حالة طلبك',
          message: `تم تحديث حالة طلب تعريب "${request.gameName}" إلى: ${getStatusAr(status)}${reason ? ` — السبب: ${reason}` : ''}`,
          data: { requestId: id, from: request.status, to: status } as never,
        },
      })
    } catch (e) {
      console.error('[admin/mod-requests PATCH notify] failed:', e)
    }

    return ok({ success: true, message: 'تم تحديث حالة الطلب' })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/mod-requests PATCH] failed:', err)
    return internalError('فشل تحديث حالة الطلب')
  }
}
