import type { NextRequest } from 'next/server'
import { clearRoleCookie, type getSession, requireAuth, invalidateUserSessions } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logAction } from '@/lib/audit'
import { ok } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getSession>>
  try {
    user = await requireAuth()
  } catch {
    // المستخدم غير مسجل دخول أصلاً — امسح الكوكيز بحذر
    try {
      await clearRoleCookie()
    } catch {}
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {}
    return ok({ message: 'تم تسجيل الخروج بنجاح' })
  }

  // CRITICAL: إبطال كل الجلسات عبر كل الأجهزة — يزيد tokenVersion في DB و Redis
  try {
    await invalidateUserSessions(user.id)
  } catch (e) {
    console.error('[Logout] invalidateUserSessions failed:', e)
  }

  // مسح كوكي الجهاز الحالي
  try {
    await clearRoleCookie()
  } catch (e) {
    console.error('[Logout] clearRoleCookie failed:', e)
  }

  // تسجيل خروج Supabase
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut()
    if (error) console.error('[Logout] Supabase signOut failed:', error.message)
  } catch (e) {
    console.error('[Logout] Supabase signOut failed:', e)
  }

  // سجل تدقيق
  try {
    await logAction({
      userId: user.id,
      username: user.username,
      action: 'logout',
      entity: 'user',
      entityId: user.id,
      details: JSON.stringify({ username: user.username, allSessionsInvalidated: true }),
    })
  } catch {}

  return ok({ message: 'تم تسجيل الخروج بنجاح', success: true })
}
