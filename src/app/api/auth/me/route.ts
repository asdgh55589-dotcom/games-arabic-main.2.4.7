import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { clearRoleCookie, getBanStatus, getJWTSecret, jwtVerify } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { needsSecuritySetup } from '@/lib/onboarding'
import { createClient } from '@/lib/supabase/server'

const ROLE_COOKIE_NAME = 'ga_admin_role'

// Phase 4B: latest still-pending verification address (two-step email
// change). Null when none — best-effort, never fails the request.
async function getPendingEmail(userId: string): Promise<string | null> {
  try {
    const row = await db.emailVerificationToken.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { email: true },
    })
    return row?.email ?? null
  } catch {
    return null
  }
}

// GET /api/auth/me — المستخدم الحالي
export async function GET() {
  try {
    // 1. محاولة Supabase Auth أولاً
    try {
      const supabase = await createClient()
      const {
        data: { user: supabaseUser },
        error: supabaseError,
      } = await supabase.auth.getUser()

      if (!supabaseError && supabaseUser) {
        // يوجد Supabase session — البحث في قاعدة البيانات
        const user = await db.user.findFirst({
          where: {
            OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
          },
          select: {
            id: true,
            username: true,
            email: true,
            emailVerified: true,
            password: true,
            role: true,
            avatarUrl: true,
            bannerUrl: true,
            bio: true,
            joinedAt: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            onboardingCompleted: true,
          },
        })

        if (user) {
          const ban = getBanStatus(user)
          if (ban.banned) {
            return ok({ user: null, banned: true, banReason: ban.reason, banType: ban.type })
          }
          const { password: _pw, ...safeUser } = user
          const hasPassword = !!_pw
          return ok({
            user: {
              ...safeUser,
              hasPassword,
              pendingEmail: await getPendingEmail(user.id),
              needsSecuritySetup: needsSecuritySetup({
                hasPassword,
                email: safeUser.email,
                emailVerified: safeUser.emailVerified,
              }),
            },
          })
        }

        // المستخدم جديد — أنشئ ملف شخصي (استخدم مولد موحد)
        const { generateUsernameFromEmail } = await import('@/lib/username-generator')
        const newUsername =
          supabaseUser.user_metadata?.username ||
          (supabaseUser.email ? await generateUsernameFromEmail(supabaseUser.email) : 'مستخدم')
        const newUser = await db.user.create({
          data: {
            supabaseId: supabaseUser.id,
            username: newUsername,
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
            onboardingCompleted: newUser.onboardingCompleted,
            hasPassword: false,
            pendingEmail: null,
            needsSecuritySetup: true,
            emailVerified: newUser.emailVerified,
          },
        })
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort Supabase fallback
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
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort operation
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

    // البحث عن المستخدم في قاعدة البيانات باستخدام userId
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        password: true,
        role: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        joinedAt: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
        onboardingCompleted: true,
      },
    })

    if (!user) {
      await clearRoleCookie()
      return ok({ user: null })
    }

    // فحص tokenVersion — لو غير متطابق → الجلسة ملغاة
    if (tokenVersion !== undefined && tokenVersion !== user.tokenVersion) {
      logger.warn('[auth/me] tokenVersion mismatch — clearing cookie', {
        userId,
        tokenVersion,
        dbVersion: user.tokenVersion,
      })
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
        onboardingCompleted: user.onboardingCompleted,
        hasPassword: !!user.password,
        pendingEmail: await getPendingEmail(user.id),
        needsSecuritySetup: needsSecuritySetup({
          hasPassword: !!user.password,
          email: user.email,
          emailVerified: user.emailVerified,
        }),
        emailVerified: user.emailVerified,
      },
    })
  } catch (err) {
    logger.error('[auth/me] failed', err)
    // حاول مسح الـ cookie الفاسد حتى لو الخطأ غير متوقع
    try {
      await clearRoleCookie()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort cookie cleanup in error path
    }
    return ok({ user: null })
  }
}
