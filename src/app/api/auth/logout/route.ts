import { NextResponse } from 'next/server'
import { clearRoleCookie, getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logAction } from '@/lib/audit'

// POST /api/auth/logout — تسجيل الخروج
export async function POST() {
  try {
    const user = await getSession()
    if (user) {
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'logout',
        entity: 'user',
        entityId: user.id,
      })
    }

    // تسجيل الخروج من Supabase Auth
    const supabase = await createClient()
    await supabase.auth.signOut()

    // مسح role cookie
    await clearRoleCookie()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/logout] failed:', err)
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 })
  }
}
