import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'

const VerifySchema = z.object({
  token: z.string().min(16, 'رابط التحقق غير صالح'),
})

const INVALID = 'رابط التحقق غير صالح أو منتهي الصلاحية'

// POST /api/auth/verify-email — consume a single-use verification token.
// Deliberately unauthenticated: the 32-byte bearer token IS the credential
// (same model as POST /api/auth/reset-password). Unknown/expired/used/
// mismatched tokens share one message (anti-enumeration).
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:verify-email' })
    if (!rl.success) {
      return rateLimited()
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = VerifySchema.safeParse({
      token: typeof body?.token === 'string' ? body.token.trim() : undefined,
    })
    if (!parsed.success) {
      return validationFail({ token: INVALID })
    }

    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
    const row = await db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    })

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      return validationFail({ token: INVALID })
    }

    if (!row.user) {
      return validationFail({ token: INVALID })
    }

    // Phase 4B two-step email change: the token carries the NEW address while
    // user.email is still the old (synthetic) primary. Clicking promotes the
    // new address — after a consume-time uniqueness re-check (the address
    // could have been taken between issue and click; the UNIQUE constraint
    // is the final backstop).
    const newEmail = row.email.toLowerCase()
    const isEmailChange = row.user.email.toLowerCase() !== newEmail

    if (isEmailChange) {
      const taken = await db.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      })
      if (taken && taken.id !== row.userId) {
        return validationFail({ token: INVALID })
      }
    }

    await db.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })

    if (isEmailChange) {
      const oldEmail = row.user.email
      try {
        await db.user.update({
          where: { id: row.userId },
          data: { email: newEmail, emailVerified: true },
        })
      } catch {
        // UNIQUE race lost after the re-check — generic invalid, no oracle.
        return validationFail({ token: INVALID })
      }

      try {
        await logAction({
          userId: row.userId,
          username: row.user.username,
          action: 'email_changed',
          entity: 'user',
          entityId: row.userId,
          details: JSON.stringify({ verified: true }),
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }

      // Notify the OLD address (best-effort; synthetic Telegram addresses
      // are undeliverable and skipped — never fail the verification).
      if (!isSyntheticTelegramEmail(oldEmail)) {
        try {
          const { sendEmail } = await import('@/lib/email')
          await sendEmail({
            to: [oldEmail],
            subject: 'تم تغيير بريدك الإلكتروني',
            text: `تم تغيير البريد الإلكتروني المرتبط بحسابك (${row.user.username}) إلى ${newEmail}. إذا لم تطلب ذلك، تواصل مع الدعم فوراً.`,
            html: `<div dir="rtl"><p>تم تغيير البريد الإلكتروني المرتبط بحسابك إلى <b>${newEmail}</b>. إذا لم تطلب ذلك، تواصل مع الدعم فوراً.</p></div>`,
          })
        } catch {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification
        }
      }

      // Telegram-first: linked users get the masked new-address notice.
      {
        const { routeNotification } = await import('@/lib/notification-router')
        void routeNotification({
          userId: row.userId,
          type: 'email_change',
          data: { newEmail },
        })
      }

      return ok({ success: true, emailChanged: true })
    }

    await db.user.update({
      where: { id: row.userId },
      data: { emailVerified: true },
    })

    try {
      await logAction({
        userId: row.userId,
        username: row.user.username,
        action: 'email_verified',
        entity: 'user',
        entityId: row.userId,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ success: true })
  } catch (err) {
    logger.error({ err }, '[verify-email POST] failed')
    return internalError('حدث خطأ')
  }
}

// DELETE /api/auth/verify-email — cancel a pending email change (Phase 4B).
// Self-only: drops the caller's outstanding unused tokens so the old primary
// stays. The 24h expiry clears them anyway; this is the explicit option.
export async function DELETE() {
  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const cleared = await db.emailVerificationToken.deleteMany({
      where: { userId: session.id, usedAt: null },
    })

    try {
      await logAction({
        userId: session.id,
        action: 'email_change_cancelled',
        entity: 'user',
        entityId: session.id,
        details: JSON.stringify({ cleared: cleared.count }),
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ success: true, cleared: cleared.count })
  } catch (err) {
    logger.error({ err }, '[verify-email DELETE] failed')
    return internalError('حدث خطأ')
  }
}
