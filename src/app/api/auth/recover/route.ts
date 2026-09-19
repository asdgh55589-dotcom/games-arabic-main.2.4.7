import { createHash, randomBytes } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import { buildResetLink, sendPasswordResetEmail } from '@/lib/recovery-email'
import { routeNotification } from '@/lib/notification-router'
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
      return rateLimited()
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

    // Telegram-first: a synthetic-address user WITH a Telegram link resets
    // through the bot (token minted below, link delivered by bot). The
    // response stays generic either way.
    let telegramUserId: string | null = null
    if (!eligible && user && isSyntheticTelegramEmail(user.email)) {
      try {
        const link = await db.oAuthAccount.findFirst({
          where: { userId: user.id, provider: 'telegram' },
          select: { providerAccountId: true },
        })
        if (link) telegramUserId = user.id
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: no link → generic ok
      }
    }

    // Mint a single-use token for either path (shared rotation logic).
    async function mintToken(userId: string): Promise<string> {
      await db.passwordResetToken.deleteMany({
        where: { userId, usedAt: null },
      })
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      await db.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + RECOVERY_TTL_MS),
          ipAddress:
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            null,
        },
      })
      return rawToken
    }

    if (telegramUserId) {
      const rawToken = await mintToken(telegramUserId)
      const link = buildResetLink(getBaseUrl(req), rawToken)
      const routed = await routeNotification({
        userId: telegramUserId,
        type: 'password_reset',
        data: { resetUrl: link },
      })
      try {
        await logAction({
          userId: telegramUserId,
          username: user!.username,
          action: 'password_recovery_requested',
          entity: 'user',
          entityId: telegramUserId,
          details: JSON.stringify({ channel: 'telegram', botSent: routed.telegram }),
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }
      return ok({ success: true })
    }

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
      const rawToken = await mintToken(user.id)

      const link = buildResetLink(getBaseUrl(req), rawToken)
      // Telegram-first: linked users get the bot message (primary) + the
      // email still goes out below (existing behavior, now the backup leg).
      const routed = await routeNotification({
        userId: user.id,
        type: 'password_reset',
        data: { resetUrl: link },
      })
      const sent = routed.email
        ? true
        : await sendPasswordResetEmail(user.email, link)
      try {
        await logAction({
          userId: user.id,
          username: user.username,
          action: 'password_recovery_requested',
          entity: 'user',
          entityId: user.id,
          details: JSON.stringify({ emailSent: sent, telegramSent: routed.telegram }),
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
