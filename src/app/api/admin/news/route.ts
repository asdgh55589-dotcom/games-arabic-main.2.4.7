import { revalidatePath } from 'next/cache'
import type { NextRequest } from 'next/server'
import { fail, internalError, ok, okPaginated, validationFail } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

// GET /api/admin/news — قائمة الأخبار
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 20,
      maxLimit: 50,
    })
    const type = searchParams.get('type')
    const visible = searchParams.get('visible')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (visible === 'true') where.visible = true
    if (visible === 'false') where.visible = false

    const [total, news] = await Promise.all([
      db.news.count({ where }),
      db.news.findMany({
        where,
        orderBy: [{ order: 'asc' }, { publishAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return okPaginated(news, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 })
  } catch (err) {
    console.error('[admin/news GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}

// POST /api/admin/news — إنشاء خبر
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (body.type !== undefined && !['ticker', 'featured'].includes(body.type)) {
      return fail('VALIDATION_ERROR', 'نوع الخبر غير صالح (يجب أن يكون ticker أو featured)', 422)
    }

    if (!body.title?.trim()) return validationFail({ title: 'العنوان مطلوب' })

    const slug = slugify(body.title)
    const existing = await db.news.findUnique({ where: { slug } })
    if (existing) return validationFail({ title: 'خبر بنفس العنوان موجود بالفعل' })

    const news = await db.news.create({
      data: {
        slug,
        title: body.title.trim(),
        summary: body.summary || '',
        content: body.content || '',
        imageUrl: body.imageUrl || '',
        linkUrl: body.linkUrl || null,
        category: body.category || 'general',
        type: body.type || 'ticker',
        isSticky: body.isSticky || false,
        isAnimated: body.isAnimated !== false,
        visible: body.visible !== false,
        order: body.order || 0,
        publishAt: body.publishAt ? new Date(body.publishAt) : new Date(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })

    // ISR: revalidate public pages after news creation
    try {
      revalidatePath('/')
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort ISR revalidation
    }

    return ok(news)
  } catch (err) {
    console.error('[admin/news POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}
