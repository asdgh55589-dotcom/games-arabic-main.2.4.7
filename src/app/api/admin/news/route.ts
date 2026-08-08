import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { parsePagination } from '@/lib/api-utils'
import { slugify } from '@/lib/utils'

// GET /api/admin/news — قائمة الأخبار
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), { limit: 20, maxLimit: 50 })
    const type = searchParams.get('type')
    const visible = searchParams.get('visible')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (visible === 'true') where.visible = true
    if (visible === 'false') where.visible = false

    const [total, news] = await Promise.all([
      db.news.count({ where }),
      db.news.findMany({ where, orderBy: [{ order: 'asc' }, { publishAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    ])

    return NextResponse.json({ news, total, page, totalPages: Math.ceil(total / limit) || 1 })
  } catch (err) {
    console.error('[admin/news GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// POST /api/admin/news — إنشاء خبر
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.title?.trim()) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })

    const slug = slugify(body.title)
    const existing = await db.news.findUnique({ where: { slug } })
    if (existing) return NextResponse.json({ error: 'خبر بنفس العنوان موجود بالفعل' }, { status: 400 })

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

    return NextResponse.json({ news }, { status: 201 })
  } catch (err) {
    console.error('[admin/news POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
