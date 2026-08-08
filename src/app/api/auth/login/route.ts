import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  setRoleCookie,
  hashPassword,
  getBanStatus,
  createSupabaseAuthUser,
  type UserRole,
} from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/audit'
import { z } from 'zod'

const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب').max(100).trim(),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(200),
})

function requireOwnerEnv() {
  const username = process.env.OWNER_USERNAME
  const email = process.env.OWNER_EMAIL
  const password = process.env.OWNER_PASSWORD
  if (!username || !email || !password) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OWNER_USERNAME, OWNER_EMAIL, OWNER_PASSWORD must be set in production')
    }
    // في وضع التطوير، نستخدم قيم افتراضية مع تحذير
    console.warn('[auth/login] OWNER_USERNAME/OWNER_EMAIL/OWNER_PASSWORD not set — using dev defaults')
    return { username: username || 'owner', email: email || 'owner@localhost', password: password || 'owner123' }
  }
  return { username, email, password }
}

// كاش لمنع ensureOwnerExists من الاستدعاء المتكرر في نفس البروسيس
let ownerEnsured = false

/** ضمان وجود حساب الـ owner في Neon DB و Supabase Auth */
async function ensureOwnerExists() {
  if (ownerEnsured) return

  const existing = await db.user.findFirst({ where: { role: 'owner' } })
  if (existing) {
    ownerEnsured = true
    return
  }

  const { username, email, password } = requireOwnerEnv()

  // إنشاء الـ owner في Neon DB
  const hash = await hashPassword(password)
  const owner = await db.user.create({
    data: {
      username,
      email,
      password: hash,
      role: 'owner',
      bio: 'مالك و مؤسس منصة ألعاب بالعربي',
    },
  })

  // محاولة إنشاء الـ owner في Supabase Auth
  const supabaseId = await createSupabaseAuthUser(email, password, username)
  if (supabaseId) {
    await db.user.update({
      where: { id: owner.id },
      data: { supabaseId },
    })
  }

  ownerEnsured = true
}

// POST /api/auth/login — تسجيل الدخول باستخدام Supabase Auth
export async function POST(req: NextRequest) {
  try {
    await ensureOwnerExists()

    const body = await req.json().catch(() => ({}))
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'بيانات غير صحيحة' },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبان' },
        { status: 400 }
      )
    }

    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:login' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح من محاولات الدخول. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // البحث عن المستخدم في Neon DB للحصول على البريد الإلكتروني والدور
    const neonUser = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: username } },
          { email: { equals: username.toLowerCase() } },
        ],
      },
    })

    if (!neonUser || !neonUser.password) {
      return NextResponse.json(
        { error: 'بيانات الدخول غير صحيحة' },
        { status: 401 }
      )
    }

    // فحص الحظر قبل أي محاولة دخول
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      const msg = ban.type === 'perm'
        ? 'تم حظر حسابك بشكل دائم.'
        : `تم حظر حسابك مؤقتاً. ينتهي الحظر في ${neonUser.bannedUntil!.toLocaleDateString('ar')}`
      return NextResponse.json({ error: msg }, { status: 403 })
    }

    // فحص الصلاحية BEFORE تسجيل الدخول — مش مسموح لـ member الدخول
    if (neonUser.role === 'member') {
      return NextResponse.json(
        { error: 'لا تملك صلاحية الوصول إلى لوحة التحكم' },
        { status: 403 }
      )
    }

    // تسجيل الدخول عبر Supabase Auth
    const supabase = await createClient()
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: neonUser.email,
      password,
    })

    // لو فشل → نحاول إنشاء المستخدم في Supabase Auth ثم نعيد المحاولة
    if (authError || !authData.user) {
      console.error('[auth/login] Supabase Auth login failed for user:', neonUser.id)

      const supabaseId = await createSupabaseAuthUser(neonUser.email, password, neonUser.username)
      if (!supabaseId) {
        return NextResponse.json(
          { error: 'حسابك غير موجود في نظام المصادقة. يرجى إعداد مفتاح SUPABASE_SERVICE_ROLE_KEY أو إنشاء الحساب من لوحة تحكم Supabase.' },
          { status: 401 }
        )
      }

      // ربط الحساب في Neon DB
      await db.user.update({
        where: { id: neonUser.id },
        data: { supabaseId },
      })

      // إعادة محاولة تسجيل الدخول
      const retry = await supabase.auth.signInWithPassword({
        email: neonUser.email,
        password,
      })
      authData = retry.data
      authError = retry.error

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: 'فشل تسجيل الدخول بعد إنشاء الحساب. حاول مرة أخرى.' },
          { status: 401 }
        )
      }
    }

    // ربط supabaseId لو مش موجود في Neon DB
    if (authData.user && !neonUser.supabaseId) {
      await db.user.update({
        where: { id: neonUser.id },
        data: { supabaseId: authData.user.id },
      })
    }

    // إنشاء role cookie مع tokenVersion
    await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion)

    // تتبع تسجيل الدخول
    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    await logAction({
      userId: neonUser.id,
      username: neonUser.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser.id,
      request: req,
    })

    return NextResponse.json({
      user: {
        id: neonUser.id,
        username: neonUser.username,
        email: neonUser.email,
        role: neonUser.role,
        avatarUrl: neonUser.avatarUrl,
      },
    })
  } catch (err) {
    console.error('[auth/login] failed:', err)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}
