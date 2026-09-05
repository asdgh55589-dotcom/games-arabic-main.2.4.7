import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import {
  creatorDeleteComment,
  creatorSetHidden,
  getCommentModAuthor,
} from '@/lib/comments/repository'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const { id } = await params
  const comment = await getCommentModAuthor(id)

  if (!comment) return notFound('التعليق غير موجود')

  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  if (comment.mod.authorId !== user.id && !isAdmin) {
    return forbidden('هذا التعليق ليس على تعريبك')
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }

  if (action === 'hide') {
    await creatorSetHidden(id, true)
    return ok({ message: 'تم إخفاء التعليق' })
  }

  if (action === 'unhide') {
    await creatorSetHidden(id, false)
    return ok({ message: 'تم إظهار التعليق' })
  }

  if (action === 'delete') {
    // حذف + إعادة عدّ (إصلاح انحراف Mod.comments)
    await creatorDeleteComment(id, comment.modId)
    return ok({ message: 'تم حذف التعليق' })
  }

  return validationFail('إجراء غير صالح')
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  // Alias for delete via DELETE method
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const { id } = await params
  const comment = await getCommentModAuthor(id)
  if (!comment) return notFound('التعليق غير موجود')

  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  if (comment.mod.authorId !== user.id && !isAdmin) {
    return forbidden('هذا التعليق ليس على تعريبك')
  }

  await creatorDeleteComment(id, comment.modId)
  return ok({ message: 'تم حذف التعليق' })
}
