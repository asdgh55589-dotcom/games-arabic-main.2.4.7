import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { action } = body as { action?: string }

    if (action === 'boost') {
      const request = await db.modRequest.findUnique({ where: { id } })
      if (!request) return notFound('الطلب غير موجود')
      if (request.status !== 'open') return validationFail('يمكن دعم الطلبات المفتوحة فقط')

      await db.modRequest.update({
        where: { id },
        data: { interestCount: { increment: 1 } },
      })

      // إشعار صاحب الطلب
      if (request.userId !== user.id) {
        try {
          await db.notification.create({
            data: {
              userId: request.userId,
              actorId: user.id,
              type: 'system_announcement',
              title: '❤️ اهتمام جديد بطلبك',
              message: `${user.username} أبدى اهتماماً بطلب تعريب "${request.gameName}"`,
              data: { requestId: id, gameName: request.gameName },
            },
          })
        } catch (err) {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: boost notify is best-effort — the interestCount increment above is already committed
          // intentional: expected+handled (boost counted; notify is advisory)
          logger.warn(
            { event: 'mod_request_boost_notify_failed', action: 'boost', err },
            'boost notify failed',
          )
        }
      }

      return ok({ message: 'تم دعم الطلب' })
    }

    return validationFail('إجراء غير صالح')
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    // UNEXPECTED: boost PATCH failed past auth — control flow unchanged (still 500 via internalError).
    logger.error(
      { event: 'mod_request_patch_failed', route: 'mod-requests/[id]', err },
      'mod-requests PATCH failed',
    )
    reportError(err, { route: 'api/mod-requests/[id]', action: 'PATCH_boost' })
    return internalError('فشل')
  }
}
