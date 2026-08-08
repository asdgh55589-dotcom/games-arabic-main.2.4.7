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
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[auth/logout] Supabase signOut failed:', error.message)
    }

    // مسح role cookie (حتى لو فشل Supabase signOut)
    await clearRoleCookie()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/logout] failed:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 })
  }
}
