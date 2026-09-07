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
import { approveCreatorRequest, rejectCreatorRequest } from '@/lib/creator-requests'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/admin/creator-requests/[id] — قبول أو رفض أو ملاحظة داخلية
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { action, rejectReason, adminNotes } = body as {
      action?: string
      rejectReason?: string
      adminNotes?: string
    }

    if (!action || !['approve', 'reject', 'note'].includes(action)) {
      return validationFail('إجراء غير صالح')
    }

    const request = await db.creatorRequest.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!request) return notFound('الطلب غير موجود')

    // ملاحظة داخلية: مسموحة في أي حالة ولا تظهر لمقدم الطلب
    if (action === 'note') {
      const updated = await db.creatorRequest.update({
        where: { id: request.id },
        data: { adminNotes: adminNotes?.trim() || null },
      })
      return ok({ success: true, adminNotes: updated.adminNotes })
    }

    if (request.status !== 'pending') {
      return validationFail('هذا الطلب تمت معالجته بالفعل')
    }

    if (action === 'approve') {
      await approveCreatorRequest(request, admin.id)
      return ok({ success: true })
    }

    // reject
    if (!rejectReason?.trim()) {
      return validationFail('يجب كتابة سبب الرفض')
    }

    await rejectCreatorRequest(request, admin.id, rejectReason.trim())

    return ok({ success: true })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/creator-requests PATCH] failed:', err)
    return internalError('فشل معالجة الطلب')
  }
}
