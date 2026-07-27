import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

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
      return NextResponse.json({ error: 'الإشعار غير موجود' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.type) updateData.type = body.type
    if (body.title) updateData.title = body.title
    if (body.message) updateData.message = body.message

    await db.notification.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/notifications/[id] PATCH] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
