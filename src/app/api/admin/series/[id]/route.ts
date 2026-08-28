import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { slugify, syncSeriesCounts } from '@/lib/series-helpers'
import { ok, forbidden, notFound, internalError } from '@/lib/api-response'

// GET /api/admin/series/[id] — تفاصيل السلسلة
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const series = await db.series.findUnique({
      where: { id },
      include: {
        mods: {
          select: { id: true, name: true, slug: true, downloads: true, endorsements: true, thumbnailUrl: true },
          orderBy: { downloads: 'desc' },
        },
        _count: { select: { mods: true } },
      },
    })

    if (!series) {
      return notFound('السلسلة غير موجودة')
    }

    return ok(series)
  } catch (err) {
    console.error('[admin/series/[id] GET] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/admin/series/[id] — تعديل السلسلة
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.series.findUnique({ where: { id } })
    if (!existing) {
      return notFound('السلسلة غير موجودة')
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      data.name = body.name.trim()
      data.slug = slugify(body.name)
    }
    if (body.description !== undefined) data.description = body.description
    if (body.bannerUrl !== undefined) data.bannerUrl = body.bannerUrl
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl
    if (body.color !== undefined) data.color = body.color
    if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
    if (body.isOfficial !== undefined) data.isOfficial = body.isOfficial
    if (body.order !== undefined) data.order = body.order

    const series = await db.series.update({ where: { id }, data })
    return ok(series)
  } catch (err) {
    console.error('[admin/series/[id] PUT] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/admin/series/[id] — حذف السلسلة (يلغي الربط فقط)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireModerator()
    if (!canDelete(user)) {
      return forbidden('لا تملك صلاحية الحذف')
    }
    const { id } = await params

    const existing = await db.series.findUnique({ where: { id } })
    if (!existing) {
      return notFound('السلسلة غير موجودة')
    }

    // إلغاء الربط من التعريبات
    await db.mod.updateMany({
      where: { seriesId: id },
      data: { seriesId: null },
    })

    await db.series.delete({ where: { id } })
    return ok({ success: true })
  } catch (err) {
    console.error('[admin/series/[id] DELETE] failed:', err)
    return internalError('Failed')
  }
}
