import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { revalidateTag } from '@/lib/cache'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PUT /api/admin/ads/[id] — تعديل إعلان
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.homepageAd.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowed = ['type', 'url', 'title', 'description', 'link', 'size', 'order', 'visible']
    for (const field of allowed) {
      if (body[field] !== undefined) {
        if (field === 'visible') {
          updateData[field] = Boolean(body[field])
        } else if (field === 'order') {
          updateData[field] = Number(body[field])
        } else {
          updateData[field] = body[field]
        }
      }
    }

    await db.homepageAd.update({ where: { id }, data: updateData })
    await revalidateTag('ads')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/ads/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/ads/[id] — حذف إعلان
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    if (!canDelete(user)) {
      return NextResponse.json({ error: 'لا تملك صلاحية الحذف' }, { status: 403 })
    }
    const { id } = await params

    const existing = await db.homepageAd.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ad not found' }, { status: 404 })
    }

    await db.homepageAd.delete({ where: { id } })
    await revalidateTag('ads')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/ads/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
