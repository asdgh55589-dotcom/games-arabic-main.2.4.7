import { createHash, randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { fail, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import {
  RESEND_MAX_PER_HOUR,
  VERIFICATION_TTL_MS,
  buildVerifyLink,
  sendVerificationEmail,
} from '@/lib/verification-email'

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

// POST /api/auth/verify-email/resend — authed, self-only. Rotates any pending
// token (so only the newest link works), then re-sends. Max 3/hour per user,
// counted in the DB so the cap survives restarts and instances.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:verify-resend' })
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

    const neonUser = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, username: true, email: true, emailVerified: true },
    })
    if (!neonUser) return unauthorized()

    // Phase 4B two-step: while an email change is pending, user.email is
    // still the old (synthetic) primary — resend to the PENDING address from
    // the outstanding token, not to the synthetic primary.
    const pendingToken = await db.emailVerificationToken.findFirst({
      where: { userId: neonUser.id, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true },
    })
    const targetEmail = (pendingToken?.email || neonUser.email).toLowerCase()

    if (isSyntheticTelegramEmail(targetEmail)) {
      return validationFail({ email: 'أضف بريداً إلكترونياً حقيقياً أولاً من الإعدادات' })
    }

    if (neonUser.emailVerified && !pendingToken) {
      return ok({ success: true, already: true })
    }

    const sentLastHour = await db.emailVerificationToken.count({
      where: { userId: neonUser.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    if (sentLastHour >= RESEND_MAX_PER_HOUR) {
      return fail(
        'RESEND_LIMITED',
        'تجاوزت الحد الأقصى لإعادة الإرسال (٣ في الساعة)، حاول لاحقاً',
        429,
      )
    }

    await db.emailVerificationToken.deleteMany({
      where: { userId: neonUser.id, usedAt: null },
    })

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    await db.emailVerificationToken.create({
      data: {
        userId: neonUser.id,
        email: targetEmail,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        ipAddress:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          null,
      },
    })

    const verificationSent = await sendVerificationEmail(
      targetEmail,
      buildVerifyLink(getBaseUrl(req), rawToken),
    )

    try {
      await logAction({
        userId: neonUser.id,
        username: neonUser.username,
        action: 'email_verification_resent',
        entity: 'user',
        entityId: neonUser.id,
        details: JSON.stringify({ verificationSent }),
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ success: true, verificationSent })
  } catch (err) {
    logger.error({ err }, '[verify-email/resend POST] failed')
    return internalError('حدث خطأ')
  }
}
