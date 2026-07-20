import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications — قائمة الإشعارات
export async function GET(req: NextRequest) {
  try {
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

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const unreadOnly = searchParams.get('unread') === 'true'

    const where: Record<string, unknown> = { userId: neonUser.id }
    if (unreadOnly) where.readAt = null

    const [total, unreadCount, notifications] = await Promise.all([
      db.notification.count({ where }),
      db.notification.count({ where: { userId: neonUser.id, readAt: null } }),
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          readAt: true,
          createdAt: true,
        },
      }),
    ])

    // Extract link and actor info from data JSON
    const shapedNotifications = notifications.map((n) => {
      const d = (n.data as Record<string, unknown>) || {}
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: typeof d.link === 'string' ? d.link : null,
        readAt: n.readAt,
        createdAt: n.createdAt,
        actor: typeof d.actorId === 'string' ? { id: d.actorId, username: '', avatarUrl: null } : null,
      }
    })

    return NextResponse.json({
      notifications: shapedNotifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[notifications GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
