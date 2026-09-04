import type { NextRequest } from 'next/server'
import { internalError, notFound, ok, unauthorized } from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireUser() {
  return getOptionalSession()
}

// GET /api/notifications/[id] — جلب إشعار واحد
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return unauthorized()
    }

    const { id } = await params

    const notification = await db.notification.findFirst({
      where: { id, userId: neonUser.id },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        data: true,
        readAt: true,
        createdAt: true,
      },
    })
    if (!notification) {
      return notFound()
    }

    return ok(notification)
  } catch (err) {
    console.error('[notification GET] failed:', err)
    return internalError('Failed')
  }
}

// DELETE /api/notifications/[id] — حذف إشعار
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return unauthorized()
    }

    const { id } = await params

    const notification = await db.notification.findFirst({
      where: { id, userId: neonUser.id },
    })
    if (!notification) {
      return notFound()
    }

    await db.notification.delete({ where: { id } })

    return ok({ success: true })
  } catch (err) {
    console.error('[notification DELETE] failed:', err)
    return internalError('Failed')
  }
}
