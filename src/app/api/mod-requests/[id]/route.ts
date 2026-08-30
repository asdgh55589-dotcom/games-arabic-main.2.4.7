import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, validationFail, notFound, internalError, unauthorized } from '@/lib/api-response'

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
        } catch {}
      }

      return ok({ message: 'تم دعم الطلب' })
    }

    return validationFail('إجراء غير صالح')
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    console.error('[mod-requests PATCH] failed:', err)
    return internalError('فشل')
  }
}
