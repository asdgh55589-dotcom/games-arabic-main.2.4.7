import type { NextRequest } from 'next/server'
import {
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/admin/creator-requests/[id] — قبول أو رفض طلب
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { action, rejectReason } = body as { action?: string; rejectReason?: string }

    if (!action || !['approve', 'reject'].includes(action)) {
      return validationFail('إجراء غير صالح')
    }

    const request = await db.creatorRequest.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!request) return notFound('الطلب غير موجود')
    if (request.status !== 'pending') {
      return validationFail('هذا الطلب تمت معالجته بالفعل')
    }

    if (action === 'approve') {
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: request.userId },
          data: { role: 'creator' },
        })
        await tx.creatorRequest.update({
          where: { id: request.id },
          data: { status: 'approved', reviewedBy: admin.id, reviewedAt: new Date() },
        })
      })

      // إشعار المستخدم
      try {
        await db.notification.create({
          data: {
            userId: request.userId,
            actorId: admin.id,
            type: 'admin_action',
            title: '🎉 مبروك! أنت الآن معرّب رسمي',
            message: 'تم قبول طلبك. يمكنك الآن رفع تعريباتك ومشاركتها مع المجتمع.',
            data: { requestId: request.id },
          },
        })
      } catch (e) {
        console.error('[creator-requests PATCH approve notify] failed:', e)
      }

      return ok({ success: true })
    }

    // reject
    if (!rejectReason?.trim()) {
      return validationFail('يجب كتابة سبب الرفض')
    }

    await db.creatorRequest.update({
      where: { id: request.id },
      data: {
        status: 'rejected',
        rejectReason: rejectReason.trim(),
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
    })

    try {
      await db.notification.create({
        data: {
          userId: request.userId,
          actorId: admin.id,
          type: 'admin_action',
          title: '❌ تم رفض طلب الترقية',
          message: `تم رفض طلبك. السبب: ${rejectReason.trim()}`,
          data: { requestId: request.id, rejectReason: rejectReason.trim() },
        },
      })
    } catch (e) {
      console.error('[creator-requests PATCH reject notify] failed:', e)
    }

    return ok({ success: true })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/creator-requests PATCH] failed:', err)
    return internalError('فشل معالجة الطلب')
  }
}
