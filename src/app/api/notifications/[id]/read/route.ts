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

// PATCH /api/notifications/[id]/read — تعليم إشعار كمقروء
export async function PATCH(_req: NextRequest, { params }: RouteParams) {
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

    await db.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[notification read] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/notifications/[id]/read — تعليم إشعار كمقروء (backwards compat)
export async function PUT(req: NextRequest, { params }: RouteParams) {
  return PATCH(req, { params })
}
