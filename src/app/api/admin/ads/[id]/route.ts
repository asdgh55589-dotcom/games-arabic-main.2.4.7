import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { canDelete, requireModerator } from '@/lib/auth'
import { revalidateTag } from '@/lib/cache'
import { db } from '@/lib/db'

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
      return notFound('Ad not found')
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

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/ads/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}

// DELETE /api/admin/ads/[id] — حذف إعلان
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireModerator()
    if (!canDelete(user)) {
      return forbidden('لا تملك صلاحية الحذف')
    }
    const { id } = await params

    const existing = await db.homepageAd.findUnique({ where: { id } })
    if (!existing) {
      return notFound('Ad not found')
    }

    await db.homepageAd.delete({ where: { id } })
    await revalidateTag('ads')

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/ads/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}
