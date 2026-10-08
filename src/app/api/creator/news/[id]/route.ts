import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { canPublishNews } from '@/lib/permissions'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import { sanitizeUrl } from '@/lib/sanitize'

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

  // B4 — flood guard on edits (10/hr), same as create.
  const limited = await rateLimitMiddleware(req, {
    limit: 10,
    window: 3600,
    keyPrefix: `creator:news:${user.id}`,
  })
  if (limited) return limited

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body?.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (title.length < 3 || title.length > 120) return validationFail('العنوان مطلوب (3-120 حرفاً)')
    data.title = title
  }
  if (body?.summary !== undefined) {
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    if (summary.length > 500) return validationFail('الملخص طويل جداً (الحد الأقصى 500 حرف)')
    data.summary = summary
  }
  if (body?.content !== undefined) {
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (content.length > 20000) return validationFail('المحتوى طويل جداً (الحد الأقصى 20000 حرف)')
    data.content = content
  }
  if (body?.imageUrl !== undefined) {
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : ''
    if (imageUrl.length > 500) return validationFail('رابط الصورة طويل جداً (الحد الأقصى 500 حرف)')
    if (imageUrl) {
      const safe = sanitizeUrl(imageUrl)
      if (!safe || !/^https:/i.test(safe)) return validationFail('رابط الصورة يجب أن يبدأ بـ https://')
      data.imageUrl = safe
    } else {
      data.imageUrl = ''
    }
  }
  if (body?.linkUrl !== undefined) {
    const raw = typeof body.linkUrl === 'string' && body.linkUrl.trim() ? body.linkUrl.trim() : null
    if (raw && raw.length > 500) return validationFail('الرابط الخارجي طويل جداً (الحد الأقصى 500 حرف)')
    if (raw) {
      const safe = sanitizeUrl(raw)
      if (!safe || !/^https?:/i.test(safe)) return validationFail('الرابط الخارجي غير صالح')
      data.linkUrl = safe
    } else {
      data.linkUrl = null
    }
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
