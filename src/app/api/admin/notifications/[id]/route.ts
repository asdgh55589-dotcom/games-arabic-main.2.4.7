import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** اقتطاع قيم التدقيق حتى لا ينفجر عمود details برسالة إشعار طويلة. */
function auditValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return value.length > 200 ? `${value.slice(0, 200)}…` : value
}

/**
 * PATCH /api/admin/notifications/[id]
 *
 * مسار ميّت (لا واجهة تستدعيه — P4 يوصلها لاحقاً). جعلناه آمناً فقط:
 *  - فشل الصلاحية → 401/403 لا 500.
 *  - عدم وجود الإشعار → 404 قبل أي قراءة للجسم.
 *  - جسم غير صالح أو بلا حقول → 422 برسالة عربية بدل نجاح زائف/500.
 *  - كل تعديل ناجح يُدوَّن في سجل التدقيق (كان هذا المسار يغيّر محتوى إشعار
 *    المستخدم بلا أي أثر يمكن تتبعه).
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const actor = await requireModerator()
    const { id } = await params

    const notification = await db.notification.findUnique({
      where: { id },
      select: { id: true, type: true, title: true, message: true },
    })
    if (!notification) {
      return notFound('الإشعار غير موجود')
    }

    const body = await req.json().catch(() => ({}))

    const updateData: Record<string, unknown> = {}
    if (body.type) updateData.type = body.type
    if (body.title) updateData.title = body.title
    if (body.message) updateData.message = body.message

    if (Object.keys(updateData).length === 0) {
      return fail(
        'VALIDATION_ERROR',
        'لا توجد حقول للتحديث',
        422,
        { formErrors: ['لا توجد حقول للتحديث'], fieldErrors: {} },
        undefined,
        req.nextUrl.pathname,
      )
    }

    await db.notification.update({ where: { id }, data: updateData })

    await logAction({
      userId: actor.id,
      username: actor.username,
      action: 'NOTIFICATION_UPDATED',
      entity: 'notification',
      entityId: id,
      details: JSON.stringify({ fields: Object.keys(updateData) }),
      before: {
        type: auditValue(notification.type),
        title: auditValue(notification.title),
        message: auditValue(notification.message),
      },
      after: Object.fromEntries(Object.entries(updateData).map(([k, v]) => [k, auditValue(v)])),
      request: req,
    })

    return ok({ success: true })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — هذه الصفحة للمشرفين فقط')
    logger.error('[admin/notifications/[id] PATCH] failed:', err)
    return internalError('Failed')
  }
}
