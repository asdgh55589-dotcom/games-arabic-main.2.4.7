import { clearRoleCookie, getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logAction } from '@/lib/audit'
import { ok, internalError } from '@/lib/api-response'

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

    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[auth/logout] Supabase signOut failed:', error.message)
    }

    await clearRoleCookie()

    return ok({ success: true })
  } catch (err) {
    console.error('[auth/logout] failed:', err instanceof Error ? err.message : 'unknown error')
    return internalError('Failed to logout')
  }
}
