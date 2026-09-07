import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { canPublishNews } from '@/lib/permissions'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function ownNews(id: string, userId: string) {
  return db.news.findFirst({ where: { id, authorId: userId } })
}

// PATCH /api/creator/news/[id] — own rows only (legacy staff rows with
// authorId NULL are invisible here by construction).
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')
  if (!canPublishNews(user.role)) {
    return forbidden('نشر الأخبار متاح لمسار الناشر فقط')
  }

  const { id } = await params
  const row = await ownNews(id, user.id)
  if (!row) return notFound('الخبر غير موجود')

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body?.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (title.length < 3 || title.length > 120) return validationFail('العنوان مطلوب (3-120 حرفاً)')
    data.title = title
  }
  if (body?.summary !== undefined) {
    data.summary = typeof body.summary === 'string' ? body.summary.trim().slice(0, 500) : ''
  }
  if (body?.content !== undefined) {
    data.content = typeof body.content === 'string' ? body.content.trim().slice(0, 20000) : ''
  }
  if (body?.imageUrl !== undefined) {
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (imageUrl && !/^https:\/\//i.test(imageUrl)) return validationFail('رابط الصورة يجب أن يبدأ بـ https://')
    data.imageUrl = imageUrl
  }
  if (body?.linkUrl !== undefined) {
    const linkUrl = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim() : null
    if (linkUrl && !/^https?:\/\//i.test(linkUrl)) return validationFail('الرابط الخارجي غير صالح')
    data.linkUrl = linkUrl
  }
  if (body?.category !== undefined) {
    if (!['general', 'update', 'announcement', 'event'].includes(body.category)) {
      return validationFail('التصنيف غير صالح')
    }
    data.category = body.category
  }
  if (body?.type !== undefined) {
    if (!['ticker', 'featured'].includes(body.type)) return validationFail('النوع غير صالح')
    data.type = body.type
  }
  if (body?.visible !== undefined) data.visible = body.visible === true

  if (Object.keys(data).length === 0) return validationFail('لا توجد حقول للتحديث')

  const updated = await db.news.update({
    where: { id },
    data,
    select: { id: true, slug: true, title: true, visible: true, updatedAt: true },
  })
  return ok({ news: updated })
}

// DELETE /api/creator/news/[id] — own rows only.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')
  if (!canPublishNews(user.role)) {
    return forbidden('نشر الأخبار متاح لمسار الناشر فقط')
  }

  const { id } = await params
  const row = await ownNews(id, user.id)
  if (!row) return notFound('الخبر غير موجود')

  await db.news.delete({ where: { id } })
  return ok({ deleted: true })
}
