import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { approveCreatorRequest, rejectCreatorRequest } from '@/lib/creator-requests'
import { db } from '@/lib/db'

// POST /api/admin/creator-requests/bulk — قبول/رفض جماعي (admin/manager/owner فقط)
// Body: { action: 'approve' | 'reject', ids: string[], rejectReason?: string }
// يتجاوز الطلبات غير المعلقة مع تقرير per-item بدل فشل الدفعة كاملة.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await req.json()
    const { action, ids, rejectReason } = body as {
      action?: string
      ids?: string[]
      rejectReason?: string
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return validationFail('إجراء غير صالح')
    }
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) {
      return validationFail('اختر من 1 إلى 50 طلباً')
    }
    if (action === 'reject' && !rejectReason?.trim()) {
      return validationFail('يجب كتابة سبب الرفض للرفض الجماعي')
    }

    const uniqueIds = [...new Set(ids)]
    const results: Array<{ id: string; ok: boolean; error?: string }> = []

    for (const id of uniqueIds) {
      const request = await db.creatorRequest.findUnique({ where: { id } })
      if (!request) {
        results.push({ id, ok: false, error: 'غير موجود' })
        continue
      }
      if (request.status !== 'pending') {
        results.push({ id, ok: false, error: 'تمت معالجته بالفعل' })
        continue
      }
      try {
        if (action === 'approve') {
          await approveCreatorRequest(request, admin.id)
        } else {
          await rejectCreatorRequest(request, admin.id, rejectReason!.trim())
        }
        results.push({ id, ok: true })
      } catch (e) {
        console.error('[admin/creator-requests bulk] failed:', id, e)
        results.push({ id, ok: false, error: 'خطأ داخلي' })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    return ok({ succeeded, failed: results.length - succeeded, results })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/creator-requests bulk] failed:', err)
    return internalError('فشل العملية الجماعية')
  }
}
