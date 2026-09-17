import { createHash, randomBytes } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { buildResetLink, sendPasswordResetEmail } from '@/lib/recovery-email'
import { reportError } from '@/lib/error-reporting'
import { EmailSchema } from '@/lib/schemas'

export const RECOVERY_TTL_MS = 60 * 60 * 1000 // 1h, single-use

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000'
  const protocol = req.headers.get('x-forwarded-proto') || 'https'
  return `${protocol}://${host}`
}

// POST /api/auth/recover — D.6-c: request a password-reset email.
// ALWAYS returns generic ok (anti-enumeration); per-IP rate limited.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 900, keyPrefix: 'auth:recover' })
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort rate limit fail-open
  }

  try {
    const body = await req.json().catch(() => null)
    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!rawEmail || EmailSchema.safeParse(rawEmail).success === false) {
      return validationFail({ email: 'البريد الإلكتروني غير صحيح' })
    }

    const user = await db.user.findUnique({
      where: { email: rawEmail },
      select: { id: true, username: true, email: true, supabaseId: true, emailVerified: true },
    })

    // Eligible: real deliverable email + Supabase identity to reset.
    // Everyone else gets the identical generic response (no oracle).
    const eligible =
      user && !isSyntheticTelegramEmail(user.email) && !!user.supabaseId

    if (eligible) {
      // Verification gate: an address added via setup stays closed for
      // recovery until the inbox is proven. Legacy rows (email-signup users
      // with no verification history) keep working unchanged. Strangers get
      // the generic ok (no oracle); the authenticated owner gets a clear
      // verify-first message instead.
      const everIssued = await db.emailVerificationToken
        .count({ where: { userId: user.id } })
        .catch(() => 0)
      if (!user.emailVerified && everIssued > 0) {
        const session = await getOptionalSession().catch(() => null)
        if (session && session.id === user.id) {
          return NextResponse.json(
            {
              error:
                'بريدك الإلكتروني غير مؤكد — تحقق منه أولاً عبر الرابط المرسل إليك، أو أعد الإرسال من الإعدادات.',
              code: 'EMAIL_UNVERIFIED',
            },
            { status: 403 },
          )
        }
        return ok({ success: true })
      }

      // Rotate: drop outstanding unused tokens so only the newest works.
      await db.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      })

      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RECOVERY_TTL_MS),
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            null,
        },
      })

      const link = buildResetLink(getBaseUrl(req), rawToken)
      const sent = await sendPasswordResetEmail(user.email, link)
      try {
        await logAction({
          userId: user.id,
          username: user.username,
          action: 'password_recovery_requested',
          entity: 'user',
          entityId: user.id,
          details: JSON.stringify({ emailSent: sent }),
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[recover] failed:', err instanceof Error ? err.message : 'unknown')
    reportError(err, { route: 'POST /api/auth/recover' })
    return internalError('حدث خطأ')
  }
}
