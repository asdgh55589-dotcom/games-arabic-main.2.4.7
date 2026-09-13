import type { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { clearRoleCookie, type getSession, invalidateUserSessions, requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  let user: Awaited<ReturnType<typeof getSession>>
  try {
    user = await requireAuth()
  } catch {
    // المستخدم غير مسجل دخول أصلاً — امسح الكوكيز بحذر
    try {
      await clearRoleCookie()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort cookie cleanup
    }
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort Supabase signOut
    }
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
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
  }

  return ok({ message: 'تم تسجيل الخروج بنجاح', success: true })
}
