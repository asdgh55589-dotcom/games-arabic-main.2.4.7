import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

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

    const comment = await db.modComment.findUnique({ where: { id } })
    if (!comment) return notFound()

    const updated = await db.modComment.update({
      where: { id },
      data: {
        isPinned: body.isPinned !== undefined ? Boolean(body.isPinned) : comment.isPinned,
      },
    })

    return ok(updated)
  } catch (err) {
    console.error('[admin/comments/[id] PUT] failed:', err)
    return authFail(err) ?? internalError('Failed')
  }
}

// DELETE /api/admin/comments/[id] — حذف تعليق واحد
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params

    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, modId: true },
    })
    if (!comment) return notFound()

    // Wrap delete + count update in a transaction for atomicity
    await db.$transaction(async (tx) => {
      await tx.modComment.delete({ where: { id } })
      const count = await tx.modComment.count({ where: { modId: comment.modId } })
      await tx.mod.update({ where: { id: comment.modId }, data: { comments: count } })
    })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/comments/[id] DELETE] failed:', err)
    return authFail(err) ?? internalError('Failed')
  }
}
