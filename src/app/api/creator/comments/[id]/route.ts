import { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, validationFail, notFound, forbidden } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const { id } = await params
  const comment = await db.modComment.findUnique({
    where: { id },
    include: { mod: { select: { authorId: true } } },
  })

  if (!comment) return notFound('التعليق غير موجود')

  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  if (comment.mod.authorId !== user.id && !isAdmin) {
    return forbidden('هذا التعليق ليس على تعريبك')
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body as { action?: string }

  if (action === 'hide') {
    await db.modComment.update({
      where: { id },
      data: { isHidden: true },
    })
    return ok({ message: 'تم إخفاء التعليق' })
  }

  if (action === 'unhide') {
    await db.modComment.update({
      where: { id },
      data: { isHidden: false },
    })
    return ok({ message: 'تم إظهار التعليق' })
  }

  if (action === 'delete') {
    await db.modComment.delete({ where: { id } })
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
  const comment = await db.modComment.findUnique({
    where: { id },
    include: { mod: { select: { authorId: true } } },
  })
  if (!comment) return notFound('التعليق غير موجود')

  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  if (comment.mod.authorId !== user.id && !isAdmin) {
    return forbidden('هذا التعليق ليس على تعريبك')
  }

  await db.modComment.delete({ where: { id } })
  return ok({ message: 'تم حذف التعليق' })
}
