/**
 * lib/auth.ts — نظام المصادقة (Supabase Auth + Neon DB).
 *
 * يستخدم:
 *   - Supabase Auth للمصادقة عبر OAuth (Google, Discord, Telegram)
 *   - Neon DB (Prisma) لبيانات المستخدمين والأدوار
 *   - role cookie موقّع (JWT) للتحقق من الصلاحيات في الـ middleware (Edge runtime)
 *
 * الصلاحيات (التسلسل: member < creator < publisher < moderator < admin < manager < owner):
 *   - owner     → كل شيء + إدارة الأدوار + إعدادات الموقع
 *   - manager   → كل شيء تقريباً ما عدا تعيين owner
 *   - admin     → كل التعريبات/الألعاب + إدارة المستخدمين
 *   - moderator → نشر/تعديل التعريبات (تعريبه بس) — مش حذف
 *   - publisher → ناشر
 *   - creator   → مُعَرِّب معتمد (ينشئ تعريبات ويرسلها للمراجعة)
 *   - member    → مش لوحة تحكم
 *
 * ملاحظة: المستخدمون العاديون يسجّلون عبر OAuth فقط.
 *          كلمة المرور تُستخدم فقط لإدارة حساب Owner في وضع التطوير.
 */

import type { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'
import { hasRoleAtLeast } from '@/lib/roles'

// Re-export for use in other modules
export { jwtVerify }
import bcrypt from 'bcryptjs'
import { cookies, headers } from 'next/headers'
import { db } from './db'
import { createClient } from './supabase/server'
import { setTokenVersionCache } from './token-version-cache'
import { logger } from './logger'
import { authenticateApiKey } from './api-key-auth'

export const getJWTSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
}

const JWT_SECRET = getJWTSecret()

const ROLE_COOKIE_NAME = 'ga_admin_role'
const ROLE_COOKIE_DURATION = 60 * 60 * 24 * 7 // 7 أيام بالثواني

// ===== Role types =====
export type UserRole =
  | 'member'
  | 'creator'
  | 'publisher'
  | 'moderator'
  | 'admin'
  | 'manager'
  | 'owner'

// ===== User type returned by getSession =====
export interface SessionUser {
  id: string
  username: string
  email: string
  role: UserRole
  avatarUrl: string | null
}

// ===== Password helpers =====

/** تشفير كلمة المرور باستخدام bcrypt */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

// ===== Session helpers (server-side) =====

/**
 * قراءة الـ session الحالي — يتحقق من API Key أولاً، ثم Supabase Auth، ثم role cookie
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    // 0. فحص API Key أولاً (Authorization: Bearer sk_live_...)
    try {
      const hdrs = await headers()
      const authHeader = hdrs.get('authorization')
      if (authHeader) {
        const apiKeyResult = await authenticateApiKey(authHeader)
        if (apiKeyResult) {
          return apiKeyResult.user
        }
      }
    } catch {
      // headers() قد تفشل في بعض السياقات — نكمل مع الأ_other methods
    }

    // 1. محاولة Supabase Auth أولاً
    let supabaseUser: { id: string; email?: string } | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      supabaseUser = user
    } catch {
      // Supabase غير متاح — نكمل مع role cookie
    }

    if (supabaseUser) {
      // يوجد Supabase session — البحث في Neon DB
      const user = await db.user.findFirst({
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
        },
      })

      if (!user) return null

      // فحص الحظر
      const ban = getBanStatus(user)
      if (ban.banned) return null

      // التحقق من tokenVersion ضد الـ role cookie
      try {
        const cookieStore = await cookies()
        const token = cookieStore.get(ROLE_COOKIE_NAME)?.value
        if (token) {
          const { payload } = await jwtVerify(token, JWT_SECRET)
          if (typeof payload.tv === 'number' && payload.tv !== user.tokenVersion) {
            // مسح الكوكي بنفس خيارات setRoleCookie (domain/path)
            const delOpts: any = {
              name: ROLE_COOKIE_NAME,
              value: '',
              path: '/',
              httpOnly: true,
              sameSite: 'lax' as const,
              secure: process.env.NODE_ENV === 'production',
              maxAge: 0,
            }
            if (process.env.COOKIE_DOMAIN) delOpts.domain = process.env.COOKIE_DOMAIN
            cookieStore.set(delOpts)
            return null
          }
        } else if (user.tokenVersion > 0) {
          return null
        }
      } catch {
        return null
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role as UserRole,
        avatarUrl: user.avatarUrl,
      }
    }

    // 2. لا يوجد Supabase session — فحص role cookie (للمستخدمين عبر Telegram)
    const cookieStore = await cookies()
    const roleToken = cookieStore.get(ROLE_COOKIE_NAME)?.value

    if (!roleToken) return null

    // التحقق من الـ JWT token
    const { payload } = await jwtVerify(roleToken, JWT_SECRET)
    const userId = payload.userId as string
    const role = payload.role as string
    const tokenVersion = payload.tv as number | undefined

    if (!userId || !role) return null

    // البحث عن المستخدم في Neon DB
    const user = await db.user.findUnique({
      where: { id: userId },
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
      },
    })

    if (!user) return null

    // فحص tokenVersion
    if (tokenVersion !== undefined && tokenVersion !== user.tokenVersion) {
      return null
    }

    // فحص الحظر
    const ban = getBanStatus(user)
    if (ban.banned) return null

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role as UserRole,
      avatarUrl: user.avatarUrl,
    }
  } catch {
    return null
  }
}

// ===== Role cookie helpers =====

/** إنشاء role cookie — بيحط الـ userId + role + tokenVersion + mfa في httpOnly cookie موقّع */
export async function setRoleCookie(
  userId: string,
  role: UserRole,
  tokenVersion?: number,
  mfaVerified: boolean = false,
): Promise<void> {
  const payload: Record<string, unknown> = { userId, role }
  if (tokenVersion !== undefined) payload.tv = tokenVersion
  if (mfaVerified) payload.mfa = true

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ROLE_COOKIE_DURATION}s`)
    .sign(JWT_SECRET)

  const cookieStore = await cookies()
  cookieStore.set(ROLE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ROLE_COOKIE_DURATION,
    domain: process.env.COOKIE_DOMAIN || undefined,
  })
}

/** مسح الـ role cookie — يجب أن يطابق EXACT نفس خيارات setRoleCookie */
export async function clearRoleCookie(): Promise<void> {
  const cookieStore = await cookies()
  const cookieOptions: any = {
    name: ROLE_COOKIE_NAME,
    value: '',
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  }
  if (process.env.COOKIE_DOMAIN) {
    cookieOptions.domain = process.env.COOKIE_DOMAIN
  }
  cookieStore.set(cookieOptions)
}

// ===== Authorization helpers =====

/** يتأكد إن المستخدم مسجّل دخول — يرجّع user أو يرمي error — أي دور */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    throw new AuthError('Unauthorized', 401)
  }
  return user
}

/** يتأكد إن المستخدم أدمن أو أعلى (admin | manager | owner) — يطابق PERMISSION_MIN_ROLE site.settings/admin */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!hasRoleAtLeast(user.role, 'admin')) {
    throw new AuthError('Forbidden — admin access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مالك فقط (owner) — يطابق system.subscriptions / users.promoteAdmins */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'owner') {
    throw new AuthError('Forbidden — owner access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مشرف أو أعلى (moderator | admin | manager | owner) — يطابق mod.review/reports.manage */
export async function requireModerator(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!hasRoleAtLeast(user.role, 'moderator')) {
    throw new AuthError('Forbidden — moderator access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مُعَرِّب أو أعلى (creator | publisher | moderator | admin | manager | owner) — يطابق mod.createOwn */
export async function requireCreator(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!hasRoleAtLeast(user.role, 'creator')) {
    throw new AuthError('Forbidden — creator access required', 403)
  }
  return user
}

/** حارس خاص للوحة تحكم المُعَرِّب — يعيد { user } أو { error: Response } ليتناسب مع نمط API المحدد */
export async function requireCreatorStudio(
  req: NextRequest,
): Promise<{ user: SessionUser | null; error: NextResponse | null }> {
  try {
    const user = await requireAuth()
    const CREATOR_ONLY = ['creator', 'publisher']
    if (!CREATOR_ONLY.includes(user.role)) {
      const { forbidden } = await import('@/lib/api-response')
      return { user: null, error: forbidden('هذه الصفحة متاحة للمُعَرِّبين والناشرين فقط') }
    }
    return { user, error: null }
  } catch (err) {
    const status = (err as { status?: number })?.status || 401
    const { unauthorized, forbidden: forbiddenResp } = await import('@/lib/api-response')
    if (status === 401) return { user: null, error: unauthorized('يجب تسجيل الدخول') }
    return { user: null, error: forbiddenResp('هذه الصفحة متاحة للمُعَرِّبين والناشرين فقط') }
  }
}

/** يتأكد إن المستخدم مدير أو أعلى (manager | owner) — يطابق site.settings/system.apiKeys */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!hasRoleAtLeast(user.role, 'manager')) {
    throw new AuthError('Forbidden — manager access required', 403)
  }
  return user
}

/** فحص صلاحية: هل المستخدم يقدر يعدّل تعريب معيّن؟
 *  - admin/owner: أي تعريب
 *  - moderator/creator/publisher: تعريبه فقط (authorId === user.id)
 */
export function canEditMod(user: SessionUser, mod: { authorId: string }): boolean {
  if (user.role === 'admin' || user.role === 'owner') return true
  if (
    (user.role === 'moderator' || user.role === 'creator' || user.role === 'publisher') &&
    mod.authorId === user.id
  )
    return true
  return false
}

/** فحص صلاحية: هل المستخدم يقدر يحذف؟
 *  - admin/owner فقط
 */
export function canDelete(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'owner'
}

// ===== Ban system helpers =====

export interface BanStatusResult {
  banned: boolean
  type: 'temp' | 'perm' | null
  expiresAt: Date | null
  reason: string | null
}

/** فحص حالة الحظر (يفرّق مؤقت/دائم/منتهٍ) — يستخدم banStatus + bannedUntil */
export function getBanStatus(user: {
  banStatus?: string | null
  bannedUntil?: Date | null
  banReason?: string | null
}): BanStatusResult {
  const status = user.banStatus || 'active'
  if (status === 'active') {
    return { banned: false, type: null, expiresAt: null, reason: null }
  }
  if (status === 'banned_perm') {
    return { banned: true, type: 'perm', expiresAt: null, reason: user.banReason || null }
  }
  if (status === 'banned_temp') {
    const expiresAt = user.bannedUntil || null
    // لو انتهت المدة → فعلياً مش محظور
    if (expiresAt && expiresAt <= new Date()) {
      return { banned: false, type: null, expiresAt: null, reason: null }
    }
    return { banned: true, type: 'temp', expiresAt, reason: user.banReason || null }
  }
  if (status === 'restricted') {
    // مقيّد — مش محظور كلياً لكن محدود
    return { banned: false, type: null, expiresAt: null, reason: user.banReason || null }
  }
  return { banned: false, type: null, expiresAt: null, reason: null }
}

/** زيادة tokenVersion → يُبطل كل الكوكيز القديمة */
export async function invalidateUserSessions(userId: string): Promise<number> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })
    // Write new tokenVersion to Redis cache for Edge middleware
    await setTokenVersionCache(userId, user.tokenVersion)
    return user.tokenVersion
  } catch (err) {
    logger.error('[invalidateUserSessions] failed', err)
    return -1
  }
}

/** استخراج IP من طلب Next.js */
export function getClientIp(req: { headers: Headers }): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}

// ===== Error class =====

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

// ===== Middleware helpers (Edge runtime compatible) =====

/** قراءة userId من الـ role cookie — رخيصة (JWT محلي، بدون شبكة أو DB) — للعدادات */
export async function getUserIdFromRequestCookies(req: Request): Promise<string | null> {
  try {
    const cookieHeader = req.headers.get('cookie')
    if (!cookieHeader) return null
    const match = cookieHeader.match(/(?:^|;\s*)ga_admin_role=([^;]+)/)
    if (!match?.[1]) return null
    const { payload } = await jwtVerify(match[1], JWT_SECRET)
    return typeof payload.userId === 'string' ? payload.userId : null
  } catch {
    return null
  }
}

// ===== Supabase Auth admin helpers =====

/** إنشاء مستخدم في Supabase Auth باستخدام service role key */
export async function createSupabaseAuthUser(
  email: string,
  password: string,
  username: string,
  options?: { emailConfirm?: boolean },
): Promise<string | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_SERVICE_ROLE_KEY') return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: options?.emailConfirm ?? true,
        user_metadata: { username },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.id as string
  } catch {
    return null
  }
}

// ===== Optional Session Helper =====

/** Read session without throwing — returns null if not logged in */
export async function getOptionalSession(): Promise<SessionUser | null> {
  try {
    return await getSession()
  } catch {
    return null
  }
}
