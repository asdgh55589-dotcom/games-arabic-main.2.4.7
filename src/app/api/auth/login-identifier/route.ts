import bcrypt from 'bcryptjs'
import { type NextRequest, NextResponse } from 'next/server'
import {
  forbidden,
  internalError,
  ok,
  rateLimited,
  validationFail,
} from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { getBanStatus, setRoleCookie, type UserRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
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
import { createSessionLedger } from '@/lib/session-ledger'
import { z } from 'zod'

const IdentifierLoginSchema = z.object({
  identifier: z.string().trim().min(1, 'أدخل اسم المستخدم أو البريد').max(100),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(200),
  captchaToken: z.string().optional(),
})

// POST /api/auth/login-identifier — username-or-email + password login.
// Member counterpart of the staff /api/auth/login (which requires a security
// key and blocks members). Verifies the Neon bcrypt hash, then issues the
// same first-class role-cookie + ledger session Telegram logins use — no
// Supabase involvement, so password-only Telegram users can log in by
// username. Anti-enumeration: every credential failure returns the SAME 401
// after a progressive composite (identifier+IP) delay. No hard lockouts.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = IdentifierLoginSchema.safeParse({
      identifier: typeof body?.identifier === 'string' ? body.identifier : undefined,
      password: typeof body?.password === 'string' ? body.password : undefined,
      captchaToken: typeof body?.captchaToken === 'string' ? body.captchaToken : undefined,
    })
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }
    const { identifier, password } = parsed.data

    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:login-identifier' })
    if (!rl.success) {
      return rateLimited()
    }

    // Distributed per-IP guard (Upstash, no-op without env) — additive.
    const { checkRateLimit } = await import('@/lib/ratelimit')
    const loginIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (!(await checkRateLimit(`auth:login-identifier:${loginIp}`))) {
      return rateLimited()
    }

    const fkey = failureKey(loginIp, identifier)
    const failClosed = async () => {
      const fails = await recordLoginFailure(fkey)
      await sleep(loginDelayFor(fails) * 1000)
      return NextResponse.json({ error: LOGIN_GENERIC_ERROR }, { status: 401 })
    }

    // Turnstile hook: required after 5 fails (placeholder when unconfigured).
    if (captchaRequired(await getLoginFailures(fkey))) {
      const verdict = await verifyCaptchaToken(parsed.data.captchaToken || '', loginIp)
      if (!verdict.ok) return failClosed()
    }

    const isEmail = identifier.includes('@')
    const neonUser = isEmail
      ? await db.user.findUnique({ where: { email: identifier.toLowerCase() } })
      : await db.user.findUnique({ where: { username: identifier } })

    if (!neonUser || !neonUser.password) {
      return failClosed()
    }

    const passwordValid = await bcrypt.compare(password, neonUser.password)
    if (!passwordValid) {
      return failClosed()
    }

    // Ban gate (same messages as staff login — the holder is authenticated).
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      const msg =
        ban.type === 'perm'
          ? 'Your account has been permanently banned.'
          : `Your account has been temporarily banned. Ban expires on ${neonUser.bannedUntil!.toLocaleDateString('en')}`
      return forbidden(msg)
    }

    // Role-cookie + ledger session (no Supabase — same class as Telegram logins).
    await setRoleCookie(
      neonUser.id,
      neonUser.role as UserRole,
      neonUser.tokenVersion,
      false,
      neonUser.onboardingCompleted,
    )
    await clearLoginFailures(fkey)

    let ledgerToken: string | null = null
    let ledgerExpires: Date | null = null
    try {
      const ua = req.headers.get('user-agent') || null
      const row = await createSessionLedger(neonUser.id, { ip: loginIp, userAgent: ua })
      ledgerToken = row.token
      ledgerExpires = row.expiresAt
    } catch (e) {
      logger.warn({ err: e }, '[login-identifier] ledger create failed (fail-soft)')
    }

    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    try {
      await logAction({
        userId: neonUser.id,
        username: neonUser.username,
        action: 'login',
        entity: 'user',
        entityId: neonUser.id,
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    const res = ok({
      user: {
        id: neonUser.id,
        username: neonUser.username,
        email: neonUser.email,
        role: neonUser.role,
        avatarUrl: neonUser.avatarUrl,
      },
    })
    if (ledgerToken && ledgerExpires) {
      res.cookies.set('ga_session_ledger', ledgerToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: ledgerExpires,
      })
    }
    return res
  } catch (err) {
    logger.error({ err }, '[login-identifier POST] failed')
    reportError(err, { route: 'POST /api/auth/login-identifier' })
    return internalError('Login failed')
  }
}
