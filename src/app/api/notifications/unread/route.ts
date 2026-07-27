import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications/unread — الإشعارات غير المقروءة
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ notifications: [] })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ notifications: [] })
    }

    const rawNotifications = await db.notification.findMany({
      where: {
        userId: neonUser.id,
        readAt: null,
      },
      orderBy: { createdAt: 'desc' },
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

    const notifications = rawNotifications.map((n) => ({
      ...n,
      actor: (n.data as any)?.actor || null,
      link: (n.data as any)?.link || null,
    }))

    return NextResponse.json({ notifications })
  } catch (err) {
    console.error('[notifications unread GET] failed:', err)
    return NextResponse.json({ notifications: [] }, { status: 500 })
  }
}
