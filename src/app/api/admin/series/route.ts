import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { slugify } from '@/lib/series-helpers'
import { ok, conflict, validationFail, internalError } from '@/lib/api-response'

// GET /api/admin/series — قائمة السلاسل
export async function GET() {
  try {
    await requireModerator()
    const series = await db.series.findMany({
      orderBy: [{ order: 'asc' }, { modCount: 'desc' }],
      include: { _count: { select: { mods: true } } },
    })

    return ok(series)
  } catch (err) {
    console.error('[admin/series GET] failed:', err)
    return internalError('Failed')
  }
}

// POST /api/admin/series — إنشاء سلسلة جديدة
export async function POST(req: NextRequest) {
  try {
    await requireModerator()
    const body = await req.json()

    if (!body.name?.trim()) {
      return validationFail({ field: 'name', message: 'الاسم مطلوب' })
    }

    const slug = slugify(body.name)
    const existing = await db.series.findUnique({ where: { slug } })
    if (existing) {
      return conflict('سلسلة بنفس الاسم موجودة بالفعل')
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

    return ok(series)
  } catch (err) {
    console.error('[admin/series POST] failed:', err)
    return internalError('Failed')
  }
}
