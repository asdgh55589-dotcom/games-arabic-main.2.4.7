import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const { id } = await params
  const request = await db.modRequest.findUnique({ where: { id } })
  if (!request) return notFound('الطلب غير موجود')

  const body = await req.json().catch(() => ({}))
  const { action, modId } = body as { action?: string; modId?: string }

  if (action === 'accept') {
    if (request.status !== 'open') {
      return validationFail('هذا الطلب لم يعد متاحاً')
    }

    // Optional linked mod must belong to the accepter (prevent steal-by-link).
    if (modId) {
      const mod = await db.mod.findUnique({
        where: { id: modId },
        select: { id: true, authorId: true },
      })
      if (!mod || mod.authorId !== user.id) {
        return validationFail('التعريب غير موجود أو ليس لك')
      }
    }

    // Atomic claim: only one accepter can win a race on the same request.
    const claimed = await db.modRequest.updateMany({
      where: { id, status: 'open' },
      data: {
        status: 'accepted',
        acceptedBy: user.id,
        acceptedAt: new Date(),
        ...(modId ? { modId } : {}),
      },
    })
    if (claimed.count === 0) {
      return validationFail('هذا الطلب لم يعد متاحاً')
    }

    try {
      await db.notification.create({
        data: {
          userId: request.userId,
          actorId: user.id,
          type: 'system_announcement',
          title: '🎉 تم قبول طلبك!',
          message: `قام ${user.username} بقبول طلب تعريب "${request.gameName}"`,
          data: { requestId: id, gameName: request.gameName },
        },
      })
    } catch {}

    return ok({ message: 'تم قبول الطلب بنجاح' })
  }

  if (action === 'complete') {
    if (request.acceptedBy !== user.id) {
      return forbidden('أنت لم تقبل هذا الطلب')
    }

    if (!modId) {
      return validationFail('يرجى ربط الطلب بالتعريب')
    }

    const mod = await db.mod.findUnique({
      where: { id: modId },
      select: { id: true, authorId: true },
    })
    if (!mod || mod.authorId !== user.id) {
      return validationFail('التعريب غير موجود أو ليس لك')
    }

    await db.modRequest.update({
      where: { id },
      data: {
        status: 'completed',
        modId,
      },
    })

    try {
      await db.notification.create({
        data: {
          userId: request.userId,
          actorId: user.id,
          type: 'system_announcement',
          title: '🎊 تعريبك جاهز!',
          message: `تم إكمال تعريب "${request.gameName}" الذي طلبته`,
          data: { requestId: id, modId, gameName: request.gameName },
        },
      })
    } catch {}

    return ok({ message: 'تم إكمال الطلب' })
  }

  if (action === 'cancel') {
    // Requester or staff can always cancel. The accepter may release the
    // request back to open while work has not started (not completed).
    if (request.acceptedBy === user.id && request.status === 'accepted') {
      await db.modRequest.update({
        where: { id },
        data: { status: 'open', acceptedBy: null, acceptedAt: null },
      })
      return ok({ message: 'تم إلغاء قبول الطلب وإعادته للطلبات المتاحة' })
    }
    if (request.userId !== user.id && !['admin', 'manager', 'owner'].includes(user.role)) {
      return forbidden('لا تملك صلاحية إلغاء هذا الطلب')
    }
    await db.modRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })
    return ok({ message: 'تم إلغاء الطلب' })
  }

  if (action === 'boost') {
    // 1 boost/hour per user per request (spam guard).
    const limited = await rateLimitMiddleware(req, {
      limit: 1,
      window: 3600,
      keyPrefix: `creator:boost:${user.id}:${id}`,
    })
    if (limited) return limited

    await db.modRequest.update({
      where: { id },
      data: { interestCount: { increment: 1 } },
    })
    return ok({ message: 'تم دعم الطلب' })
  }

  return validationFail('إجراء غير صالح')
}
