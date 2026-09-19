import type { NextRequest, NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { clearRoleCookie, type getSession, invalidateUserSessions, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { revokeSession } from '@/lib/session-ledger'
import { createClient } from '@/lib/supabase/server'

/** Clear the ledger cookie with the same attributes it was set with. */
function clearLedgerCookie(res: NextResponse): void {
  res.cookies.set('ga_session_ledger', '', { path: '/', maxAge: 0 })
}

export async function POST(req: NextRequest) {
  const presentedLedger = req.cookies.get('ga_session_ledger')?.value || null

  // Invalidate the /api/auth/me cache entry immediately (fail-open).
  try {
    const { invalidateAuthMeCache } = await import('@/app/api/auth/me/route')
    await invalidateAuthMeCache(req.cookies.get('ga_admin_role')?.value || '')
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort invalidation — 60s TTL converges anyway
  }

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
    // Revoke the presented ledger token even without a session (stolen-cookie hygiene).
    if (presentedLedger) {
      try {
        await revokeSession(presentedLedger)
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort revoke
      }
    }
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort Supabase signOut
    }
    const res = ok({ message: 'تم تسجيل الخروج بنجاح' })
    clearLedgerCookie(res)
    return res
  }

  // CRITICAL: إبطال كل الجلسات عبر كل الأجهزة — يزيد tokenVersion في DB و Redis
  try {
    await invalidateUserSessions(user.id)
  } catch (e) {
    console.error('[Logout] invalidateUserSessions failed:', e)
  }

  // إبطال كل صفوف الـ ledger الخاصة بالمستخدم (كل الأجهزة) — فوري وغير قابل لإعادة الاستخدام
  try {
    await db.session.deleteMany({ where: { userId: user.id } })
  } catch (e) {
    console.error('[Logout] ledger revoke-all failed:', e)
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

  const res = ok({ message: 'تم تسجيل الخروج بنجاح', success: true })
  clearLedgerCookie(res)
  return res
}
