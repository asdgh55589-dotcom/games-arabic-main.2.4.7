import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { clearRoleCookie, getBanStatus, getJWTSecret, jwtVerify } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { needsSecuritySetup } from '@/lib/onboarding'
import { redisDel, redisGet, redisSet } from '@/lib/redis'
import { createClient } from '@/lib/supabase/server'

const ROLE_COOKIE_NAME = 'ga_admin_role'

/** /api/auth/me payload cache TTL (seconds) — SWR-style, invalidated on logout. */
const ME_CACHE_TTL_S = 60
/** Abort slow Supabase Auth calls instead of hanging the request. */
const SUPABASE_TIMEOUT_MS = 3_000

/** Cache key for the role-cookie path (token hashed, never raw). */
export function authMeCacheKey(roleToken: string): string {
  return `auth:me:${createHash('sha256').update(roleToken).digest('hex')}`
}

/** Invalidate a user's /me cache entry (call on logout / token rotation). */
export async function invalidateAuthMeCache(roleToken: string): Promise<void> {
  if (!roleToken) return
  try {
    await redisDel(authMeCacheKey(roleToken))
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort invalidation — 60s TTL converges anyway
  }
}

/**
 * Per-user /me generation counter. Role-change paths bump it so a cached
 * payload written before the change is never served afterwards (the cache
 * is keyed by token hash, which the role-change path doesn't hold).
 */
export function authMeGenKey(userId: string): string {
  return `auth:me-gen:${userId}`
}

export async function getAuthMeGeneration(userId: string): Promise<number> {
  try {
    const v = await redisGet<number>(authMeGenKey(userId))
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0
  } catch {
    return 0
  }
}

/** Bump the generation (call after role change / session invalidation). Fail-open. */
export async function bumpAuthMeGeneration(userId: string): Promise<void> {
  try {
    const { redisIncr } = await import('@/lib/redis')
    await redisIncr(authMeGenKey(userId), 24 * 60 * 60)
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort — tv check still rejects stale tokens
  }
}

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

// Phase 3: user-specific session payload — never cache (browser, CDN, or proxy).
const NO_STORE = {
  headers: { 'Cache-Control': 'private, no-store, must-revalidate' },
} as const

export async function GET() {
  try {
    // 1. محاولة Supabase Auth أولاً (بمهلة 3 ثوانٍ — لا تعلّق الطلب)
    try {
      const supabase = await createClient()
      const {
        data: { user: supabaseUser },
        error: supabaseError,
      } = (await Promise.race([
        supabase.auth.getUser(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Supabase getUser timeout')), SUPABASE_TIMEOUT_MS),
        ),
      ])) as Awaited<ReturnType<typeof supabase.auth.getUser>>

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
            return ok(
              { user: null, banned: true, banReason: ban.reason, banType: ban.type },
              NO_STORE,
            )
          }
          const { password: _pw, ...safeUser } = user
          const hasPassword = !!_pw
          return ok(
            {
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
            },
            NO_STORE,
          )
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
        return ok(
          {
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
          },
          NO_STORE,
        )
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort Supabase fallback
    }

    // 2. لا يوجد Supabase session — فحص role cookie (للمستخدمين عبر Telegram)
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const roleToken = cookieStore.get(ROLE_COOKIE_NAME)?.value

    if (!roleToken) {
      return ok({ user: null }, NO_STORE)
    }

    // Fast path: cached payload (60s TTL, invalidated on logout).
    // Generation-guarded: a role change bumps the per-user generation, so
    // entries written before the change are treated as a miss.
    const meCacheKey = authMeCacheKey(roleToken)
    try {
      const cached = await redisGet<{
        gen?: number
        uid?: string
        payload?: Record<string, unknown>
      }>(meCacheKey)
      if (cached !== null && cached?.payload) {
        const gen = await getAuthMeGeneration(String(cached.uid || ''))
        if (!cached.uid || gen === (cached.gen ?? 0)) return ok(cached.payload, NO_STORE)
      } else if (cached !== null && !(cached as Record<string, unknown>).payload) {
        // Legacy unwrapped entry (pre-generation) — serve as-is.
        return ok(cached as unknown as Record<string, unknown>, NO_STORE)
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: cache miss → DB below
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
      return ok({ user: null }, NO_STORE)
    }
    const userId = payload.userId as string
    const role = payload.role as string
    const tokenVersion = payload.tv as number | undefined

    if (!userId || !role) {
      await clearRoleCookie()
      return ok({ user: null }, NO_STORE)
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
      return ok({ user: null }, NO_STORE)
    }

    // فحص tokenVersion — لو غير متطابق → الجلسة ملغاة
    if (tokenVersion !== undefined && tokenVersion !== user.tokenVersion) {
      logger.warn('[auth/me] tokenVersion mismatch — clearing cookie', {
        userId,
        tokenVersion,
        dbVersion: user.tokenVersion,
      })
      await clearRoleCookie()
      return ok({ user: null }, NO_STORE)
    }

    // فحص حالة الحظر
    const ban = getBanStatus(user)
    if (ban.banned) {
      const bannedPayload = { user: null, banned: true, banReason: ban.reason, banType: ban.type }
      const gen = await getAuthMeGeneration(user.id)
      await redisSet(
        meCacheKey,
        { gen, uid: user.id, payload: bannedPayload },
        ME_CACHE_TTL_S,
      ).catch(() => {})
      return ok(bannedPayload, NO_STORE)
    }

    const mePayload = {
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
    }
    await redisSet(
      meCacheKey,
      { gen: await getAuthMeGeneration(user.id), uid: user.id, payload: mePayload },
      ME_CACHE_TTL_S,
    ).catch(() => {})
    return ok(mePayload, NO_STORE)
  } catch (err) {
    logger.error('[auth/me] failed', err)
    // حاول مسح الـ cookie الفاسد حتى لو الخطأ غير متوقع
    try {
      await clearRoleCookie()
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort cookie cleanup in error path
    }
    return ok({ user: null }, NO_STORE)
  }
}
