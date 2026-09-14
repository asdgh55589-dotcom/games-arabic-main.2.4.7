import bcrypt from 'bcryptjs'
import { type NextRequest, NextResponse } from 'next/server'
import {
  forbidden,
  internalError,
  ok,
  rateLimited,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import {
  createSupabaseAuthUser,
  getBanStatus,
  hashPassword,
  setRoleCookie,
  type UserRole,
} from '@/lib/auth'
import { db } from '@/lib/db'
import {
  LOGIN_GENERIC_ERROR,
  captchaRequired,
  clearLoginFailures,
  failureKey,
  getLoginFailures,
  loginDelayFor,
  recordLoginFailure,
  sleep,
  verifyCaptchaToken,
} from '@/lib/login-defense'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { LoginSchema } from '@/lib/schemas'
import { hashSecurityKey, isSecurityKeyExpired, verifySecurityKey } from '@/lib/security-key'
import { createClient } from '@/lib/supabase/server'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

function requireOwnerEnv() {
  const username = process.env.OWNER_USERNAME
  const email = process.env.OWNER_EMAIL
  const password = process.env.OWNER_PASSWORD
  const securityKey = process.env.OWNER_SECURITY_KEY || '1234567890'
  if (!username || !email || !password) {
    throw new Error('OWNER_USERNAME, OWNER_EMAIL, OWNER_PASSWORD must be set — configure env vars')
  }
  return { username, email, password, securityKey }
}

// كاش لمنع ensureOwnerExists من الاستدعاء المتكرر في نفس البروسيس
let ownerEnsured = false

/** ضمان وجود حساب الـ owner في Neon DB و Supabase Auth */
async function ensureOwnerExists() {
  if (ownerEnsured) return

  const existing = await db.user.findFirst({ where: { role: 'owner' } })
  if (existing) {
    try {
      const { username, email, password, securityKey } = requireOwnerEnv()
      // لو المالك الحالي مختلف عن المطلوب (GADMIx → L0L0Y8) — خفّض القديم إلى عضو
      if (existing.username !== username) {
        await db.user.update({
          where: { id: existing.id },
          data: { role: 'member' },
        })
        // إنشاء المالك الجديد لو غير موجود
        const alreadyExists = await db.user.findUnique({ where: { username } })
        if (!alreadyExists) {
          const hash = await hashPassword(password)
          const secHash = await hashSecurityKey(securityKey)
          const newOwner = await db.user.create({
            data: {
              username,
              email,
              password: hash,
              securityKey: secHash,
              securityKeyExpiresAt: null,
              securityKeyChangedAt: new Date(),
              role: 'owner',
              bio: 'مالك و مؤسس منصة ألعاب بالعربي',
              onboardingCompleted: true,
            },
          })
          const supabaseId = await createSupabaseAuthUser(email, password, username).catch(
            () => null,
          )
          if (supabaseId) {
            await db.user.update({ where: { id: newOwner.id }, data: { supabaseId } })
          }
        }
        ownerEnsured = true
        return
      }
      // نفس اسم المستخدم — حدّث البيانات لو تغيّرت
      const needsUpdate = existing.email !== email || !existing.securityKey
      if (needsUpdate) {
        const hash = await hashPassword(password)
        const secHash = await hashSecurityKey(securityKey)
        await db.user.update({
          where: { id: existing.id },
          data: {
            email,
            password: hash,
            securityKey: secHash,
            securityKeyExpiresAt: null,
            securityKeyChangedAt: new Date(),
          },
        })
        await createSupabaseAuthUser(email, password, username).catch(() => null)
      }
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort owner provisioning, continues regardless
      logger.warn({ err, context: 'auth-login-ensureOwner' }, 'ensureOwnerExists failed')
    }
    ownerEnsured = true
    return
  }

  const { username, email, password, securityKey } = requireOwnerEnv()

  // إنشاء الـ owner في Neon DB مع مفتاح الأمان
  const hash = await hashPassword(password)
  const secHash = await hashSecurityKey(securityKey)
  const owner = await db.user.create({
    data: {
      username,
      email,
      password: hash,
      securityKey: secHash,
      securityKeyExpiresAt: null,
      securityKeyChangedAt: new Date(),
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
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { username, email, password, securityKey } = parsed.data

    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:login' })
    if (!rl.success) {
      return rateLimited()
    }

    // Distributed rate limit (Upstash, no-op without env) — additive guard
    const { checkRateLimit } = await import('@/lib/ratelimit')
    const loginIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (!(await checkRateLimit(`auth:login:${loginIp}`))) {
      return rateLimited()
    }

    // Audit D.2: anti-enumeration — every credential failure below returns
    // the SAME 401 message after a progressive per-IP+username delay.
    const fkey = failureKey(loginIp, typeof body?.username === 'string' ? body.username : '')
    const failClosed = async () => {
      const fails = recordLoginFailure(fkey)
      await sleep(loginDelayFor(fails) * 1000)
      return NextResponse.json({ error: LOGIN_GENERIC_ERROR }, { status: 401 })
    }

    // Turnstile hook: required after 5 fails (placeholder when unconfigured).
    if (captchaRequired(getLoginFailures(fkey))) {
      const captchaToken = typeof body?.captchaToken === 'string' ? body.captchaToken : ''
      const verdict = await verifyCaptchaToken(captchaToken, loginIp)
      if (!verdict.ok) return failClosed()
    }

    // 1. البحث عن المستخدم بواسطة اسم المستخدم أولاً (لرسائل دقيقة)
    const userByUsername = await db.user.findUnique({
      where: { username },
    })

    if (!userByUsername || !userByUsername.password) {
      return failClosed()
    }

    // 2. التحقق من تطابق البريد (حساسية حالة الأحرف غير مهمة)
    if (userByUsername.email.toLowerCase() !== email.toLowerCase()) {
      return failClosed()
    }

    const neonUser = userByUsername

    // 3. التحقق من كلمة المرور
    const passwordValid = await bcrypt.compare(password, neonUser.password!)
    if (!passwordValid) {
      return failClosed()
    }

    // 4. التحقق من وجود مفتاح الأمان
    if (!neonUser.securityKey) {
      return failClosed()
    }

    // 5. التحقق من مفتاح الأمان
    const keyValid = await verifySecurityKey(securityKey, neonUser.securityKey)
    if (!keyValid) {
      return failClosed()
    }

    // 6. فحص انتهاء صلاحية المفتاح
    if (isSecurityKeyExpired(neonUser.securityKeyExpiresAt as Date | null)) {
      return failClosed()
    }

    // فحص الحظر قبل أي محاولة دخول
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      const msg =
        ban.type === 'perm'
          ? 'Your account has been permanently banned.'
          : `Your account has been temporarily banned. Ban expires on ${neonUser.bannedUntil!.toLocaleDateString('en')}`
      return forbidden(msg)
    }

    // فحص الصلاحية BEFORE تسجيل الدخول — مش مسموح لـ member الدخول
    if (neonUser.role === 'member') {
      return forbidden('Insufficient permissions')
    }

    // تسجيل الدخول عبر Supabase Auth
    const supabase = await createClient()
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: neonUser.email,
      password,
    })

    // لو فشل → نحاول إنشاء المستخدم في Supabase Auth ثم نعيد المحاولة
    if (authError || !authData.user) {
      logger.error({ userId: neonUser.id }, '[auth/login] Supabase Auth login failed')

      const supabaseId = await createSupabaseAuthUser(neonUser.email, password, neonUser.username)
      if (!supabaseId) {
        return unauthorized('Account not found in auth system')
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
        return unauthorized('Login failed after account creation')
      }
    }

    // ربط supabaseId لو مش موجود في Neon DB
    if (authData.user && !neonUser.supabaseId) {
      await db.user.update({
        where: { id: neonUser.id },
        data: { supabaseId: authData.user.id },
      })
    }

    // فحص MFA — إذا كان مفعلاً، لا نضع الكوكيز الآن بل نطلب رمز MFA
    const freshUser = await db.user.findUnique({
      where: { id: neonUser.id },
      select: { totpEnabled: true, totpSecret: true, recoveryCodesUsed: true },
    })

    if (freshUser?.totpEnabled && freshUser.totpSecret) {
      const { generateMFAToken } = await import('@/lib/mfa-token')
      const mfaToken = await generateMFAToken(neonUser.id)
      const remainingCodes = freshUser.recoveryCodesUsed
        ? 10 - (freshUser.recoveryCodesUsed as number[]).length
        : 10
      return ok({
        mfaRequired: true,
        mfaToken,
        recoveryCodesCount: remainingCodes,
      })
    }

    // إنشاء role cookie مع tokenVersion (لا MFA)
    await setRoleCookie(
      neonUser.id,
      neonUser.role as UserRole,
      neonUser.tokenVersion,
      false,
      neonUser.onboardingCompleted,
    )
    clearLoginFailures(fkey)

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

    return ok({
      user: {
        id: neonUser.id,
        username: neonUser.username,
        email: neonUser.email,
        role: neonUser.role,
        avatarUrl: neonUser.avatarUrl,
      },
    })
  } catch (err) {
    logger.error({ err }, '[auth/login] failed')
    reportError(err, { route: 'POST /api/auth/login' })
    return internalError('Login failed')
  }
}
