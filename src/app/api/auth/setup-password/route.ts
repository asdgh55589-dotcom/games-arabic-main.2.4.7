import { createHash, randomBytes } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import {
  fail,
  internalError,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { hashPassword, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { ProvisionError, provisionSupabasePassword } from '@/lib/password-setup'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { SetupPasswordSchema } from '@/lib/schemas'
import {
  VERIFICATION_TTL_MS,
  buildVerifyLink,
  sendVerificationEmail,
} from '@/lib/verification-email'

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

// POST /api/auth/setup-password — P0-flexible: optional security setup.
// Self-only (the session user is the target — no userId parameter exists, so
// no user can set another user's password or email). Accepts password-only,
// email-only, or both (>= 1 required); skipping is done client-side by simply
// not calling. No current-password requirement when no credential exists yet.
// Password attempts with an existing credential get 409 (use change-password).
// OAuth methods (Telegram/Google) are never touched.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:setup-password' })
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const body = await req.json().catch(() => null)
    const parsed = SetupPasswordSchema.safeParse({
      password: typeof body?.password === 'string' ? body.password : undefined,
      confirmPassword: typeof body?.confirmPassword === 'string' ? body.confirmPassword : undefined,
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return validationFail({
        [String(issue?.path?.[0] || 'password')]: issue?.message || 'بيانات غير صالحة',
      })
    }
    const { password, email: newEmail } = parsed.data
    const wantsPassword = password !== undefined

    const neonUser = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, username: true, email: true, password: true, supabaseId: true },
    })
    if (!neonUser) return unauthorized()

    if (wantsPassword) {
      // min(10) passes whitespace-only input — reject it explicitly.
      if (password.trim().length < 10) {
        return validationFail({ password: 'كلمة المرور يجب أن تحتوي على أحرف حقيقية' })
      }

      // Already has a password credential → must use change-password (current required).
      if (neonUser.password) {
        return fail(
          'PASSWORD_ALREADY_SET',
          'لديك كلمة مرور بالفعل — استخدم تغيير كلمة المرور',
          409,
        )
      }

      // Policy: password must differ from username and email.
      const lowered = password.toLowerCase()
      if (
        lowered === neonUser.username.toLowerCase() ||
        lowered === neonUser.email.toLowerCase()
      ) {
        return validationFail({ password: 'كلمة المرور يجب أن تختلف عن اسم المستخدم والبريد' })
      }
    }

    // Replacement email: synthetic Telegram identities only, must be unique.
    // Non-synthetic (provider-verified) emails stay immutable here.
    let effectiveEmail = neonUser.email
    const wantsEmail = newEmail !== undefined && newEmail !== neonUser.email.toLowerCase()
    if (newEmail !== undefined && !wantsEmail && !wantsPassword) {
      return validationFail({ email: 'لا يوجد ما يُحفظ' })
    }
    if (wantsEmail) {
      if (!isSyntheticTelegramEmail(neonUser.email)) {
        return validationFail({ email: 'لا يمكن تغيير البريد الموثّق من مزوّد الدخول' })
      }
      const taken = await db.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      })
      if (taken && taken.id !== neonUser.id) {
        return validationFail({ email: 'هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر.' })
      }
      effectiveEmail = newEmail
    }

    try {
      // Phase 4B two-step email change: the new address is NEVER written to
      // user.email here. It lives only inside the verification token until
      // the inbox owner clicks the link (verify-email promotes it). The old
      // (synthetic) address stays primary meanwhile, so a typo can't lock
      // the user out.
      if (wantsPassword) {
        const data: { password?: string; supabaseId?: string } = {}
        const provisioned = await provisionSupabasePassword({
          username: neonUser.username,
          email: effectiveEmail,
          supabaseId: neonUser.supabaseId,
          password,
        })
        // bcrypt hash only — plaintext never persisted. No role / tokenVersion /
        // OAuthAccount changes, so existing OAuth logins keep working.
        data.password = await hashPassword(password)
        if (provisioned.supabaseId) data.supabaseId = provisioned.supabaseId

        await db.user.update({ where: { id: neonUser.id }, data })
      }

      // Issue the verification mail for the new address. A change of address
      // rotates (deletes) any pending token first, so only the newest link
      // works. Send failures do NOT fail the request — the settings UI offers
      // resend (max 3/hour).
      let verificationSent: boolean | undefined
      if (wantsEmail) {
        try {
          await db.emailVerificationToken.deleteMany({
            where: { userId: neonUser.id, usedAt: null },
          })
          const rawToken = randomBytes(32).toString('hex')
          const tokenHash = createHash('sha256').update(rawToken).digest('hex')
          await db.emailVerificationToken.create({
            data: {
              userId: neonUser.id,
              email: effectiveEmail,
              tokenHash,
              expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
              ipAddress:
                req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                req.headers.get('x-real-ip') ||
                null,
            },
          })
          verificationSent = await sendVerificationEmail(
            effectiveEmail,
            buildVerifyLink(getBaseUrl(req), rawToken),
          )
        } catch (e) {
          logger.warn({ err: e }, '[setup-password] verification issue failed')
          verificationSent = false
        }
      }

      try {
        await logAction({
          userId: neonUser.id,
          username: neonUser.username,
          action: wantsPassword ? 'password_setup' : 'email_setup',
          entity: 'user',
          entityId: neonUser.id,
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }

      // Deliberately no tokenVersion bump: OAuth sessions stay valid.
      return ok({
        success: true,
        ...(wantsEmail
          ? { verificationSent: !!verificationSent, needsVerification: true, pendingEmail: effectiveEmail }
          : {}),
      })
    } catch (err) {
      if (err instanceof ProvisionError) {
        if (err.code === 'HAS_PASSWORD') {
          return fail('PASSWORD_ALREADY_SET', err.message, 409)
        }
        if (err.code === 'NEED_EMAIL') {
          return validationFail({ email: err.message })
        }
        if (err.code === 'SERVICE_UNAVAILABLE') {
          return NextResponse.json(
            { error: 'خدمة الحسابات غير متاحة حالياً', code: 'SERVICE_UNAVAILABLE' },
            { status: 503 },
          )
        }
        return validationFail({ [err.field]: err.message })
      }
      throw err
    }
  } catch (err) {
    logger.error({ err }, '[setup-password POST] failed')
    return internalError('حدث خطأ')
  }
}
