import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const notification = await db.notification.findUnique({ where: { id }, select: { id: true } })
    if (!notification) {
      return notFound('الإشعار غير موجود')
    }

    const updateData: Record<string, unknown> = {}
    if (body.type) updateData.type = body.type
    if (body.title) updateData.title = body.title
    if (body.message) updateData.message = body.message

    await db.notification.update({ where: { id }, data: updateData })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/notifications/[id] PATCH] failed:', err)
    return internalError('Failed')
  }
}
