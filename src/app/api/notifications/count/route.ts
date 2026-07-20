import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications/count — عدد الإشعارات غير المقروءة
export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return NextResponse.json({ count: 0 })
    }

    const neonUser = await db.user.findFirst({
      where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
      select: { id: true },
    })
    if (!neonUser) {
      return NextResponse.json({ count: 0 })
    }

    const count = await db.notification.count({
      where: { userId: neonUser.id, readAt: null },
    })

    return NextResponse.json({ count })
  } catch (err) {
    console.error('[notifications count GET] failed:', err)
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
}
