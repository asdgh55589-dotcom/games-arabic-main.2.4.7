/**
 * lib/auth.ts — نظام المصادقة (Supabase Auth + Neon DB).
 *
 * يستخدم:
 *   - Supabase Auth للمصادقة عبر OAuth (Google, Discord, Telegram)
 *   - Neon DB (Prisma) لبيانات المستخدمين والأدوار
 *   - role cookie موقّع (JWT) للتحقق من الصلاحيات في الـ middleware (Edge runtime)
 *
 * الصلاحيات (تصاعدي):
 *   - member     → مش لوحة تحكم
 *   - publisher  → رفع/تعديل تعريباته فقط (بدون حذف)
 *   - moderator  → تعريباته + حذف + تعليقات + بلاغات
 *   - admin      → إدارة المستخدمين + الحظر + الألعاب/السلاسل +Audit
 *   - manager    → كل صلاحيات Admin + إعدادات الموقع + الأدوار + الصيانة
 *   - owner      → كل شيء + إنشاء حسابات owner
 *
 * ملاحظة: المستخدمون العاديون يسجّلون عبر OAuth فقط.
 *          كلمة المرور تُستخدم فقط لإدارة حساب Owner في وضع التطوير.
 */

import { NextRequest } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

// Re-export for use in other modules
export { jwtVerify }
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'
import { createClient } from './supabase/server'
import { setTokenVersionCache } from './token-version-cache'

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
// member → publisher → moderator → admin → manager → owner
export type UserRole = 'member' | 'publisher' | 'moderator' | 'admin' | 'manager' | 'owner'

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
 * قراءة الـ session الحالي — يتحقق من Supabase Auth ثم يجلب بيانات المستخدم من Neon DB
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()

    if (!supabaseUser) return null

    // البحث عن المستخدم في Neon DB
    const user = await db.user.findFirst({
      where: {
        OR: [
          { supabaseId: supabaseUser.id },
          { email: supabaseUser.email || '' },
        ],
      },
      select: { id: true, username: true, email: true, role: true, avatarUrl: true, banStatus: true, bannedUntil: true, banReason: true, tokenVersion: true },
    })

    if (!user) return null

    // فحص الحظر
    const ban = getBanStatus(user)
    if (ban.banned) return null

    // التحقق من tokenVersion ضد الـ role cookie
    // لو الـ cookie يحمل tv قديم → الجلسة منتهية
    // لو ما فيش cookie والمستخدم عنده tokenVersion > 0 → الجلسة منتهية (تم حذف الكوكي)
    try {
      const cookieStore = await cookies()
      const token = cookieStore.get(ROLE_COOKIE_NAME)?.value
      if (token) {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        if (typeof payload.tv === 'number' && payload.tv !== user.tokenVersion) {
          // الـ cookie قديم — نمسحه ونعتبر الجلسة منتهية
          cookieStore.delete(ROLE_COOKIE_NAME)
          return null
        }
      } else if (user.tokenVersion > 0) {
        // ما فيش cookie والمستخدم عنده tokenVersion — يعني تم حذف الكوكي يدوياً أو الحظر
        return null
      }
    } catch {
      // cookie غير صالح — نعتبر الجلسة منتهية
      return null
    }

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

/**
 * مزامنة مستخدم Supabase مع Neon DB — ينشئ أو يحدث الملف الشخصي
 */
export async function syncNeonUser(supabaseUser: {
  id: string
  email?: string
  user_metadata?: Record<string, unknown>
}): Promise<{ id: string; username: string; email: string; role: string; avatarUrl: string | null } | null> {
  try {
    const email = supabaseUser.email || ''
    const username = (supabaseUser.user_metadata?.username as string) || email.split('@')[0] || 'مستخدم'

    const existing = await db.user.findUnique({
      where: { supabaseId: supabaseUser.id },
      select: { id: true, username: true, email: true, role: true, avatarUrl: true, supabaseId: true },
    })

    if (existing) {
      // تحديث supabaseId لو مش موجود (التسجيل قبل التفعيل)
      if (!existing.supabaseId) {
        const updated = await db.user.update({
          where: { id: existing.id },
          data: { supabaseId: supabaseUser.id },
        })
        return { id: updated.id, username: updated.username, email: updated.email, role: updated.role, avatarUrl: updated.avatarUrl }
      }
      return existing
    }

    // إنشاء مستخدم جديد
    const newUser = await db.user.create({
      data: {
        supabaseId: supabaseUser.id,
        username,
        email: email.toLowerCase(),
        role: 'member',
      },
    })

    await db.notificationPreference.create({
      data: {
        userId: newUser.id,
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
        quietHoursEnabled: false,
        typePreferences: {},
      },
    }).catch(() => {})

    return { id: newUser.id, username: newUser.username, email: newUser.email, role: newUser.role, avatarUrl: newUser.avatarUrl }
  } catch {
    return null
  }
}

// ===== Role cookie helpers =====

/** إنشاء role cookie — بيحط الـ userId + role + tokenVersion في httpOnly cookie موقّع */
export async function setRoleCookie(userId: string, role: UserRole, tokenVersion?: number): Promise<void> {
  const payload: Record<string, unknown> = { userId, role }
  if (tokenVersion !== undefined) payload.tv = tokenVersion

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

/** مسح الـ role cookie */
export async function clearRoleCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ROLE_COOKIE_NAME)
}

// ===== Authorization helpers =====

/** يتأكد إن المستخدم مسجّل دخول — يرجّع user أو يرمي error */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    throw new AuthError('Unauthorized', 401)
  }
  return user
}

/** يتأكد إن المستخدم أدمن أو أعلى (admin | manager | owner) */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['admin', 'manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — admin access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مالك فقط (owner) */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== 'owner') {
    throw new AuthError('Forbidden — owner access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مشرف أو أعلى (moderator | admin | manager | owner) */
export async function requireModerator(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['moderator', 'admin', 'manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — moderator access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم ناشر أو أعلى (publisher | moderator | admin | manager | owner) */
export async function requirePublisher(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['publisher', 'moderator', 'admin', 'manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — publisher access required', 403)
  }
  return user
}

/** يتأكد إن المستخدم مدير أو أعلى (manager | owner) */
export async function requireManager(): Promise<SessionUser> {
  const user = await requireAuth()
  if (!['manager', 'owner'].includes(user.role)) {
    throw new AuthError('Forbidden — manager access required', 403)
  }
  return user
}

/** فحص صلاحية: هل المستخدم يقدر يعدّل تعريب معيّن؟
 *  - owner/admin/moderator: أي تعريب
 *  - publisher: تعريبه فقط (authorId === user.id)
 *  - member: لا يقدر
 */
export function canEditMod(user: SessionUser, mod: { authorId: string }): boolean {
  if (['owner', 'admin', 'moderator'].includes(user.role)) return true
  if (user.role === 'publisher' && mod.authorId === user.id) return true
  return false
}

/** فحص صلاحية: هل المستخدم يقدر يحذف؟
 *  - moderator | admin | manager | owner فقط
 */
export function canDelete(user: SessionUser): boolean {
  return ['moderator', 'admin', 'manager', 'owner'].includes(user.role)
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
export async function invalidateUserSessions(userId: string): Promise<void> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })
    // Write new tokenVersion to Redis cache for Edge middleware
    await setTokenVersionCache(userId, user.tokenVersion)
  } catch (err) {
    console.error('[invalidateUserSessions] failed:', err)
  }
}

/** فحص IP ضد IpBan — server-side فقط (مش Edge) */
export async function checkIpBan(ip: string): Promise<{
  banned: boolean
  reason?: string | null
  expiresAt?: Date | null
}> {
  try {
    const ban = await db.ipBan.findUnique({
      where: { ipAddress: ip },
    })
    if (!ban) return { banned: false }
    // لو مؤقت وانتهى → فعلياً مش محظور
    if (ban.expiresAt && ban.expiresAt <= new Date()) {
      return { banned: false }
    }
    return { banned: true, reason: ban.reason, expiresAt: ban.expiresAt }
  } catch (err) {
    console.error('[checkIpBan] failed:', err)
    return { banned: false }
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

/** قراءة الـ role من Request cookies (للـ middleware — Edge runtime) */
export async function getRoleFromRequestCookies(req: NextRequest): Promise<UserRole | null> {
  const token = req.cookies.get(ROLE_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload.role as UserRole
  } catch {
    return null
  }
}

// re-export cookie name for middleware
export const ROLE_COOKIE = ROLE_COOKIE_NAME

// ===== Supabase Auth admin helpers =====

/** إنشاء مستخدم في Supabase Auth باستخدام service role key */
export async function createSupabaseAuthUser(
  email: string,
  password: string,
  username: string,
  options?: { emailConfirm?: boolean }
): Promise<string | null> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_SERVICE_ROLE_KEY') return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
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

/** تحديث كلمة مرور مستخدم في Supabase Auth */
export async function updateSupabaseAuthPassword(
  supabaseId: string,
  newPassword: string
): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_SERVICE_ROLE_KEY') return false

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${supabaseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ password: newPassword }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** حذف مستخدم من Supabase Auth */
export async function deleteSupabaseAuthUser(supabaseId: string): Promise<boolean> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey || serviceRoleKey === 'REPLACE_WITH_SERVICE_ROLE_KEY') return false

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${supabaseId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    })
    return res.ok
  } catch {
    return false
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
