import type { NextRequest } from 'next/server'
import { forbidden, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { canPublishNews } from '@/lib/permissions'

// GET /api/creator/news — own news rows (drafts + published)
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')

  const rows = await db.news.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, slug: true, title: true, summary: true, content: true,
      imageUrl: true, linkUrl: true, category: true, type: true,
      visible: true, views: true, clicksCount: true,
      publishAt: true, expiresAt: true, createdAt: true, updatedAt: true,
    },
  })
  return ok({ news: rows })
}

const CATEGORIES = ['general', 'update', 'announcement', 'event'] as const
const TYPES = ['ticker', 'featured'] as const

function slugifyTitle(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'news'
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  for (let i = 0; i < 5; i++) {
    const exists = await db.news.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) return slug
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
  }
  return `${base}-${Date.now()}`
}

// POST /api/creator/news — publishers publish DIRECTLY, no admin review.
// Track gate: news.create is publisher-only (translators get 403).
// Draft = visible:false. Creator rows REQUIRE authorId (staff legacy rows
// keep authorId null and stay admin-managed).
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return validationFail('يجب تسجيل الدخول')
  if (!canPublishNews(user.role)) {
    return forbidden('نشر الأخبار متاح لمسار الناشر فقط')
  }

  const body = await req.json().catch(() => ({}))
  const title = typeof body?.title === 'string' ? body.title.trim() : ''
  const summary = typeof body?.summary === 'string' ? body.summary.trim().slice(0, 500) : ''
  const content = typeof body?.content === 'string' ? body.content.trim().slice(0, 20000) : ''
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''
  const linkUrl = typeof body?.linkUrl === 'string' ? body.linkUrl.trim() : null
  const category = typeof body?.category === 'string' ? body.category : 'general'
  const type = typeof body?.type === 'string' ? body.type : 'ticker'
  const visible = body?.visible === true

  if (title.length < 3 || title.length > 120) {
    return validationFail('العنوان مطلوب (3-120 حرفاً)')
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return validationFail('التصنيف غير صالح')
  }
  if (!TYPES.includes(type as (typeof TYPES)[number])) {
    return validationFail('النوع غير صالح (ticker أو featured)')
  }
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
    return validationFail('رابط الصورة يجب أن يبدأ بـ https://')
  }
  if (linkUrl && !/^https?:\/\//i.test(linkUrl)) {
    return validationFail('الرابط الخارجي غير صالح')
  }

  const row = await db.news.create({
    data: {
      slug: await uniqueSlug(slugifyTitle(title)),
      title,
      summary,
      content,
      imageUrl,
      linkUrl,
      category,
      type,
      visible,
      authorId: user.id,
    },
    select: { id: true, slug: true, title: true, visible: true, createdAt: true },
  })
  return ok({ news: row }, { status: 201 })
}
