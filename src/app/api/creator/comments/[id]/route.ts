import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import {
  creatorDeleteComment,
  creatorEditReply,
  creatorSetHidden,
  creatorSetPinned,
  getCommentModAuthor,
  getCommentOwner,
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
  const { action, text } = body as { action?: string; text?: string }

  if (action === 'hide') {
    await creatorSetHidden(id, true)
    return ok({ message: 'تم إخفاء التعليق' })
  }

  if (action === 'unhide') {
    await creatorSetHidden(id, false)
    return ok({ message: 'تم إظهار التعليق' })
  }

  if (action === 'pin') {
    await creatorSetPinned(id, true)
    return ok({ message: 'تم تثبيت التعليق' })
  }

  if (action === 'unpin') {
    await creatorSetPinned(id, false)
    return ok({ message: 'تم إلغاء تثبيت التعليق' })
  }

  if (action === 'edit') {
    // Edit own replies only (admins may edit any reply on the mod).
    const full = await getCommentOwner(id)
    if (!full) return notFound('التعليق غير موجود')
    if (full.userId !== user.id && !isAdmin) {
      return forbidden('يمكنك تعديل ردودك فقط')
    }
    const clean = typeof text === 'string' ? text.trim() : ''
    if (!clean) return validationFail('نص الرد مطلوب')
    if (clean.length > 2000) return validationFail('النص طويل جداً (الحد الأقصى 2000 حرف)')
    await creatorEditReply(id, clean)
    return ok({ message: 'تم تعديل الرد' })
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
