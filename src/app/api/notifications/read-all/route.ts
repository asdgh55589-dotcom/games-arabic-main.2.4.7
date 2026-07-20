import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function markAllAsRead() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const neonUser = await db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
  if (!neonUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  await db.notification.updateMany({
    where: { userId: neonUser.id, readAt: null },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

// POST /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة
export async function POST(_req: NextRequest) {
  try {
    return await markAllAsRead()
  } catch (err) {
    console.error('[notifications read-all POST] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/notifications/read-all — تعليم جميع الإشعارات كمقروءة (backwards compat)
export async function PUT() {
  try {
    return await markAllAsRead()
  } catch (err) {
    console.error('[notifications read-all PUT] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
