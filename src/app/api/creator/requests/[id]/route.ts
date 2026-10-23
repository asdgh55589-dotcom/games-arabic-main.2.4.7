import type { NextRequest } from 'next/server'
import { fail, forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { canTransition } from '@/lib/requests/state-machine'

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
    if (!canTransition(request.status, 'accepted')) {
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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: accept notify is best-effort — the atomic claim above is already committed
      // intentional: expected+handled (claim won; notify is advisory)
      logger.warn(
        { event: 'creator_request_accept_notify_failed', action: 'accept', err },
        'accept notify failed',
      )
    }

    return ok({ message: 'تم قبول الطلب بنجاح' })
  }

  if (action === 'complete') {
    // فقط accepted/in_progress يمكن إكمالهما — لا يمكن إكمال ملغى/مرفوض/مكتمل.
    if (!canTransition(request.status, 'completed')) {
      return validationFail('لا يمكن إكمال طلب في هذه الحالة')
    }

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

    const completed = await db.modRequest.updateMany({
      where: { id, status: request.status, acceptedBy: user.id },
      data: {
        status: 'completed',
        modId,
      },
    })
    if (completed.count === 0) {
      return fail('CONFLICT', 'تغيّرت حالة الطلب — أعد المحاولة', 409)
    }

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
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: complete notify is best-effort — the completed status above is already committed
      // intentional: expected+handled (request completed; notify is advisory)
      logger.warn(
        { event: 'creator_request_complete_notify_failed', action: 'complete', err },
        'complete notify failed',
      )
    }

    return ok({ message: 'تم إكمال الطلب' })
  }

  if (action === 'cancel') {
    // Requester or staff can always cancel. The accepter may release the
    // request back to open while work has not started (not completed).
    if (
      request.acceptedBy === user.id &&
      (request.status === 'accepted' || request.status === 'in_progress')
    ) {
      const released = await db.modRequest.updateMany({
        where: { id, status: request.status, acceptedBy: user.id },
        data: { status: 'open', acceptedBy: null, acceptedAt: null, modId: null },
      })
      if (released.count === 0) {
        return fail('CONFLICT', 'تغيّرت حالة الطلب — أعد المحاولة', 409)
      }
      try {
        await db.notification.create({
          data: {
            userId: request.userId,
            actorId: user.id,
            type: 'system_announcement',
            title: 'ℹ️ عاد طلبك إلى قائمة الطلبات المتاحة',
            message: `أعاد ${user.username} طلب تعريب "${request.gameName}" ليكون متاحاً لمُعَرِّب آخر`,
            data: { requestId: id, gameName: request.gameName },
          },
        })
      } catch (err) {
        logger.warn(
          { event: 'creator_request_release_notify_failed', action: 'cancel', err },
          'release notify failed',
        )
      }
      return ok({ message: 'تم إلغاء قبول الطلب وإعادته للطلبات المتاحة' })
    }
    if (request.userId !== user.id && !['admin', 'manager', 'owner'].includes(user.role)) {
      return forbidden('لا تملك صلاحية إلغاء هذا الطلب')
    }
    if (!canTransition(request.status, 'cancelled')) {
      return validationFail('لا يمكن إلغاء طلب في هذه الحالة')
    }
    const cancelled = await db.modRequest.updateMany({
      where: { id, status: request.status },
      data: { status: 'cancelled', acceptedBy: null, acceptedAt: null, modId: null },
    })
    if (cancelled.count === 0) {
      return fail('CONFLICT', 'تغيّرت حالة الطلب — أعد المحاولة', 409)
    }
    // أعلم المُعَرِّب المسؤول إن كان شخصاً آخر بأن الطلب أُلغي.
    if (request.acceptedBy && request.acceptedBy !== user.id) {
      try {
        await db.notification.create({
          data: {
            userId: request.acceptedBy,
            actorId: user.id,
            type: 'system_announcement',
            title: 'ℹ️ تم إلغاء طلب تعريب',
            message: `تم إلغاء طلب تعريب "${request.gameName}" الذي كنت مسؤولاً عنه`,
            data: { requestId: id, gameName: request.gameName },
          },
        })
      } catch (err) {
        logger.warn(
          { event: 'creator_request_cancel_notify_failed', action: 'cancel', err },
          'cancel notify failed',
        )
      }
    }
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

    const boosted = await db.modRequest.updateMany({
      where: { id, status: 'open' },
      data: { interestCount: { increment: 1 } },
    })
    if (boosted.count === 0) {
      return validationFail('يمكن دعم الطلبات المفتوحة فقط')
    }
    return ok({ message: 'تم دعم الطلب' })
  }

  return validationFail('إجراء غير صالح')
}
