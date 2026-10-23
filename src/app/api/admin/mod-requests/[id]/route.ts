import type { NextRequest } from 'next/server'
import {
  fail,
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { isCreatorRole } from '@/lib/roles'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { notifyModRequestParticipants } from '@/lib/requests/notify'
import {
  canTransition,
  getRequestStatusLabel,
  isModRequestStatus,
  type ModRequestStatus,
} from '@/lib/requests/state-machine'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/admin/mod-requests/[id] — قرار إداري على طلب تعريب
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireModerator()
    const { id } = await params

    const request = await db.modRequest.findUnique({ where: { id } })
    if (!request) return notFound('الطلب غير موجود')

    const body = await req.json().catch(() => ({}))
    const { status, acceptedBy, modId, reason } = body as {
      status?: string
      acceptedBy?: string | null
      modId?: string | null
      reason?: string | null
    }

    if (!status || !isModRequestStatus(status)) {
      return validationFail('حالة غير صالحة')
    }

    if (!canTransition(request.status, status)) {
      return fail(
        'INVALID_STATE_TRANSITION',
        `لا يمكن الانتقال من "${getRequestStatusLabel(request.status)}" إلى "${getRequestStatusLabel(status)}"`,
        400,
        { from: request.status, to: status },
      )
    }

    const cleanReason = reason?.trim() || null
    if (status === 'rejected' && !cleanReason) {
      return validationFail('يرجى إدخال سبب الرفض')
    }

    // Optional translator assignment — accepts a user id or username.
    let assignedUserId: string | null = request.acceptedBy ?? null
    if (typeof acceptedBy === 'string' && acceptedBy.trim()) {
      const user = await db.user.findFirst({
        where: { OR: [{ id: acceptedBy.trim() }, { username: acceptedBy.trim() }] },
        select: { id: true, username: true, role: true },
      })
      if (!user) return validationFail('المُعَرِّب غير موجود')
      if (!isCreatorRole(user.role)) return validationFail('المستخدم ليس مُعَرِّباً')
      assignedUserId = user.id
    }

    const data: Record<string, unknown> = {
      status,
      rejectionReason: status === 'rejected' ? cleanReason : null,
    }

    if (status === 'accepted') {
      if (!assignedUserId) return validationFail('يرجى اختيار المُعَرِّب')
      data.acceptedAt = new Date()
      if (assignedUserId) data.acceptedBy = assignedUserId
    } else if (status === 'in_progress') {
      if (typeof acceptedBy === 'string' && acceptedBy.trim()) {
        data.acceptedBy = assignedUserId
        data.acceptedAt = new Date()
      }
    } else if (status === 'completed') {
      const effectiveModId = modId?.trim() || request.modId
      if (!effectiveModId) {
        return validationFail('يرجى ربط الطلب بالتعريب المكتمل')
      }
      const mod = await db.mod.findFirst({
        where: { OR: [{ id: effectiveModId }, { slug: effectiveModId }] },
        select: { id: true },
      })
      if (!mod) return validationFail('التعريب غير موجود')
      data.modId = mod.id
      if (typeof acceptedBy === 'string' && acceptedBy.trim()) {
        data.acceptedBy = assignedUserId
      }
    } else if (status === 'cancelled' || status === 'rejected') {
      data.acceptedBy = null
      data.acceptedAt = null
      data.modId = null
    }

    // Concurrency guard: only apply the transition if the row still has the
    // status we validated above. Two admins acting at once cannot overwrite a
    // terminal state (e.g. complete a request that was just cancelled).
    const updated = await db.modRequest.updateMany({
      where: { id, status: request.status },
      data: data as never,
    })
    if (updated.count === 0) {
      return fail('CONFLICT', 'تغيّرت حالة الطلب — أعد المحاولة', 409)
    }

    // سجل النشاط
    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: admin.id,
        username: admin.username || 'admin',
        action: 'MOD_REQUEST_STATUS_CHANGED',
        entity: 'ModRequest',
        entityId: id,
        details: JSON.stringify({
          from: request.status,
          to: status,
          reason: cleanReason,
          acceptedBy: status === 'cancelled' || status === 'rejected' ? null : assignedUserId,
          modId: data.modId ?? request.modId ?? null,
        }),
      })
    } catch (err) {
      logger.warn(
        { event: 'mod_request_audit_failed', requestId: id, err },
        'mod request audit failed',
      )
    }

    // إشعار الطالب والمُعَرِّب المسؤول (best-effort)
    const notifyAssignee =
      status === 'cancelled' || status === 'rejected' ? request.acceptedBy : assignedUserId
    await notifyModRequestParticipants({
      requestId: id,
      gameName: request.gameName,
      requesterId: request.userId,
      assigneeId: notifyAssignee,
      actorId: admin.id,
      from: request.status,
      to: status as ModRequestStatus,
      reason: cleanReason,
    })

    return ok({ success: true, message: 'تم تحديث حالة الطلب', status })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    logger.error('[admin/mod-requests PATCH] failed:', err)
    return internalError('فشل تحديث حالة الطلب')
  }
}
