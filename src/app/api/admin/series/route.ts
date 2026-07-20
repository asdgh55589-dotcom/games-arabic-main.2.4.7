import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { slugify } from '@/lib/series-helpers'

// GET /api/admin/series — قائمة السلاسل
export async function GET() {
  try {
    await requireModerator()
    const series = await db.series.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      include: { _count: { select: { mods: true } } },
    })

    return NextResponse.json({ series })
  } catch (err) {
    console.error('[admin/series GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// POST /api/admin/series — إنشاء سلسلة جديدة
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'الاسم مطلوب' }, { status: 400 })
    }

    const slug = slugify(body.name)
    const existing = await db.series.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json({ error: 'سلسلة بنفس الاسم موجودة بالفعل' }, { status: 400 })
    }

    const series = await db.series.create({
      data: {
        slug,
        name: body.name.trim(),
        description: body.description || '',
        bannerUrl: body.bannerUrl || '',
        logoUrl: body.logoUrl || '',
        color: body.color || '',
        isFeatured: body.isFeatured || false,
        isOfficial: body.isOfficial || false,
        order: body.order || 0,
      },
    })

    return NextResponse.json({ series }, { status: 201 })
  } catch (err) {
    console.error('[admin/series POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
