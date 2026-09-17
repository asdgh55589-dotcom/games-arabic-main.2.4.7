import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

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
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
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

    // The token is bound to the address it was issued for: if the user has
    // since changed address, this link is dead — resend from settings.
    if (!row.user || row.user.email.toLowerCase() !== row.email.toLowerCase()) {
      return validationFail({ token: INVALID })
    }

    await db.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })
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
