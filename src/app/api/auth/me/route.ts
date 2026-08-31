import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { getBanStatus, jwtVerify, getJWTSecret, clearRoleCookie } from '@/lib/auth'
import { ok } from '@/lib/api-response'
import { logger } from '@/lib/logger'

const ROLE_COOKIE_NAME = 'ga_admin_role'

// GET /api/auth/me — المستخدم الحالي
export async function GET() {
  try {
    // 1. محاولة Supabase Auth أولاً
    try {
      const supabase = await createClient()
      const { data: { user: supabaseUser }, error: supabaseError } = await supabase.auth.getUser()

      if (!supabaseError && supabaseUser) {
        // يوجد Supabase session — البحث في Neon DB
        const user = await db.user.findFirst({
          where: {
            OR: [
              { supabaseId: supabaseUser.id },
              { email: supabaseUser.email || '' },
            ],
          },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            bannerUrl: true,
            bio: true,
            joinedAt: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
          },
        })

        if (user) {
          const ban = getBanStatus(user)
          if (ban.banned) {
            return ok({ user: null, banned: true, banReason: ban.reason, banType: ban.type })
          }
          return ok({ user })
        }

        // المستخدم جديد — أنشئ ملف شخصي
        const newUser = await db.user.create({
          data: {
            supabaseId: supabaseUser.id,
            username: supabaseUser.user_metadata?.username || supabaseUser.email?.split('@')[0] || 'مستخدم',
            email: supabaseUser.email || '',
            role: 'member',
          },
        })
        return ok({
          user: {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            avatarUrl: newUser.avatarUrl,
          },
        })
      }
    } catch {
      // تجاهل أخطاء Supabase والمتابعة مع role cookie
    }

    // 2. لا يوجد Supabase session — فحص role cookie (للمستخدمين عبر Telegram)
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const roleToken = cookieStore.get(ROLE_COOKIE_NAME)?.value

    if (!roleToken) {
      return ok({ user: null })
    }

    // التحقق من الـ JWT token
    const JWT_SECRET = getJWTSecret()
    let payload: Record<string, unknown>
    try {
      const verified = await jwtVerify(roleToken, JWT_SECRET)
      payload = verified.payload as Record<string, unknown>
    } catch {
      // JWT غير صالح (قديم أو مزور) — امسح الـ cookie الفاسد
      logger.warn('[auth/me] invalid role cookie — clearing')
      await clearRoleCookie()
      return ok({ user: null })
    }
    const userId = payload.userId as string
    const role = payload.role as string
    const tokenVersion = payload.tv as number | undefined

    if (!userId || !role) {
      await clearRoleCookie()
      return ok({ user: null })
    }

    // البحث عن المستخدم في Neon DB باستخدام userId
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        joinedAt: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
      },
    })

    if (!user) {
      await clearRoleCookie()
      return ok({ user: null })
    }

    // فحص tokenVersion — لو غير متطابق → الجلسة ملغاة
    if (tokenVersion !== undefined && tokenVersion !== user.tokenVersion) {
      logger.warn('[auth/me] tokenVersion mismatch — clearing cookie', { userId, tokenVersion, dbVersion: user.tokenVersion })
      await clearRoleCookie()
      return ok({ user: null })
    }

    // فحص حالة الحظر
    const ban = getBanStatus(user)
    if (ban.banned) {
      return ok({ user: null, banned: true, banReason: ban.reason, banType: ban.type })
    }

    return ok({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (err) {
    logger.error('[auth/me] failed', err)
    // حاول مسح الـ cookie الفاسد حتى لو الخطأ غير متوقع
    try {
      await clearRoleCookie()
    } catch {}
    return ok({ user: null })
  }
}
