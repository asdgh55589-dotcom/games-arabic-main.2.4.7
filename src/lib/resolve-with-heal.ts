import type { SessionUser, UserRole } from '@/lib/auth'
import { getBanStatus, requireAuth, setRoleCookie } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

/**
 * حل الجلسة مع إعادة إصدار كوكي الدور.
 *
 * المشكلة التي يحلها: جلسة Supabase تبقى حيّة (تُجدَّد تلقائياً) بينما كوكي
 * `ga_admin_role` ثابت 7 أيام ولا يُجدَّد. عند انتهائه يظل المستخدم "مسجّلاً"
 * في الواجهة (navbar يقرأ /api/auth/me) لكن بوابة الـEdge في proxy.ts — التي
 * تقرأ الكوكي فقط — ترميه إلى /login.
 *
 * requireAuth أولاً؛ وعند 401 (Supabase صالحة لكن الكوكي مفقود/منتهٍ/قديم بعد
 * ترقية دور) نتحقق من Supabase مباشرة ونعيد إصدار الكوكي من قيم DB الحالية
 * بدل رفض الطلب.
 */
export async function resolveUserWithHeal(): Promise<SessionUser> {
  try {
    return await requireAuth()
  } catch (err) {
    if ((err as { status?: number })?.status !== 401) throw err
    let supabaseUser: { id: string; email?: string } | null = null
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      supabaseUser = data.user
    } catch {
      throw err
    }
    if (!supabaseUser) throw err
    const dbUser = await db.user.findFirst({
      where: {
        OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
        onboardingCompleted: true,
      },
    })
    if (!dbUser || getBanStatus(dbUser).banned) throw err
    try {
      await setRoleCookie(
        dbUser.id,
        dbUser.role as UserRole,
        dbUser.tokenVersion,
        false,
        dbUser.onboardingCompleted,
      )
      logger.info(
        { userId: dbUser.id, role: dbUser.role, tokenVersion: dbUser.tokenVersion },
        '[heal] re-issued ga_admin_role from DB (Supabase session valid, cookie stale)',
      )
    } catch (healErr) {
      logger.error({ err: healErr, userId: dbUser.id }, '[heal] failed to re-issue role cookie')
    }
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      avatarUrl: dbUser.avatarUrl,
      onboardingCompleted: dbUser.onboardingCompleted,
    }
  }
}
