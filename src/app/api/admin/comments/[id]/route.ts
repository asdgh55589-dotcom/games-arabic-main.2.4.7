import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { adminDeleteComment, setCommentPinned } from '@/lib/comments/repository'

/** يحوّل خطأ صلاحيات إلى الاستجابة الصحيحة بدل 500 */
function authFail(err: unknown) {
  // duck-typing على status (يعمل مع AuthError ومع أي كائن خطأ يحمل status)
  const status = (err as { status?: number })?.status
  if (status === 401) return unauthorized('يجب تسجيل الدخول')
  if (status === 403) return forbidden('ليس لديك صلاحية')
  return null
}

// PUT /api/admin/comments/[id] — تثبيت/إلغاء تثبيت تعليق
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const updated = await setCommentPinned(
      id,
      body.isPinned !== undefined ? Boolean(body.isPinned) : undefined,
    )
    if (!updated) return notFound()

    return ok(updated)
  } catch (err) {
    console.error('[admin/comments/[id] PUT] failed:', err)
    return authFail(err) ?? internalError('فشل العملية')
  }
}

// DELETE /api/admin/comments/[id] — حذف تعليق واحد
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params

    const deleted = await adminDeleteComment(id)
    if (!deleted) return notFound()

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/comments/[id] DELETE] failed:', err)
    return authFail(err) ?? internalError('فشل العملية')
  }
}
