import type { NextRequest } from 'next/server'
import {
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import {
  deleteCommentSubtree,
  getCommentOwnership,
  updateCommentText,
} from '@/lib/comments/repository'
import { UpdateCommentSchema } from '@/lib/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/comments/[id] — تعديل التعليق (صاحب التعليق فقط)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const { id } = await params
    const comment = await getCommentOwnership(id)

    if (!comment) {
      return notFound('التعليق غير موجود')
    }

    if (comment.userId !== user.id) {
      return forbidden('ليس لديك صلاحية التعديل')
    }

    const body = await req.json()
    const parsed = UpdateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    return ok(await updateCommentText(id, parsed.data.text))
  } catch (err) {
    console.error('[comment PATCH] failed:', err)
    return internalError('فشل تعديل التعليق')
  }
}

// DELETE /api/comments/[id] — حذف التعليق (صاحب التعليق أو الأدمن)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized('يجب تسجيل الدخول')
    }

    const { id } = await params
    const comment = await getCommentOwnership(id)

    if (!comment) {
      return notFound('التعليق غير موجود')
    }

    const isOwner = comment.userId === user.id
    const isAdmin = ['owner', 'admin', 'moderator'].includes(user.role)

    if (!isOwner && !isAdmin) {
      return forbidden('ليس لديك صلاحية الحذف')
    }

    return ok(await deleteCommentSubtree(id, comment.modId))
  } catch (err) {
    console.error('[comment DELETE] failed:', err)
    return internalError('فشل حذف التعليق')
  }
}
