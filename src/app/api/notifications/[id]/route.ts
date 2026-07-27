import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  const neonUser = await db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
  return neonUser
}

// GET /api/notifications/[id] — جلب إشعار واحد
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(notification)
  } catch (err) {
    console.error('[notification GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/notifications/[id] — حذف إشعار
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const notification = await db.notification.findFirst({
      where: { id, userId: neonUser.id },
    })
    if (!notification) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await db.notification.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notification DELETE] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
