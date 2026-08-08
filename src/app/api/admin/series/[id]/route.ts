import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { slugify } from '@/lib/series-helpers'
import { syncSeriesCounts } from '@/lib/series-helpers'

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
      return NextResponse.json({ error: 'السلسلة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json({ series })
  } catch (err) {
    console.error('[admin/series/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
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
      return NextResponse.json({ error: 'السلسلة غير موجودة' }, { status: 404 })
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
    return NextResponse.json({ series })
  } catch (err) {
    console.error('[admin/series/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
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
      return NextResponse.json({ error: 'لا تملك صلاحية الحذف' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.series.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'السلسلة غير موجودة' }, { status: 404 })
    }

    // إلغاء الربط من التعريبات
    await db.mod.updateMany({
      where: { seriesId: id },
      data: { seriesId: null },
    })

    await db.series.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/series/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
