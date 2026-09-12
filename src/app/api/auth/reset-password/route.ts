import { createHash } from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { invalidateUserSessions } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { PasswordSchema } from '@/lib/schemas'
import { createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const ResetSchema = z.object({
  token: z.string().min(16, 'رابط الاستعادة غير صالح'),
  password: PasswordSchema,
})

const INVALID = 'رابط الاستعادة غير صالح أو منتهي الصلاحية'

// POST /api/auth/reset-password — D.6-c: consume a single-use token.
// Unknown/expired/used tokens share one message (anti-enumeration).
// Success bumps tokenVersion (all other sessions die) and forces re-login.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:reset-password' })
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
    }
  } catch {
    // fail-open
  }

  try {
    const body = await req.json().catch(() => null)
    const parsed = ResetSchema.safeParse({
      token: typeof body?.token === 'string' ? body.token.trim() : undefined,
      password: typeof body?.password === 'string' ? body.password : undefined,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      // Weak password gets its specific message; bad token stays generic.
      if (issue?.path?.[0] === 'password') {
        return validationFail({ password: issue.message })
      }
      return validationFail({ token: INVALID })
    }

    const tokenHash = createHash('sha256').update(parsed.data.token).digest('hex')
    const row = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, username: true, email: true, supabaseId: true } },
      },
    })

    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      return validationFail({ token: INVALID })
    }

    if (!row.user?.supabaseId) {
      return validationFail({ token: INVALID })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'خدمة الحسابات غير متاحة حالياً', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      )
    }

    const { error } = await admin.auth.admin.updateUserById(row.user.supabaseId, {
      password: parsed.data.password,
    })
    if (error) {
      console.error('[reset-password] supabase update failed:', error.message)
      return validationFail({ token: INVALID })
    }

    await db.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    })

    // Kill every other session (incl. a potential attacker session).
    await invalidateUserSessions(row.userId)

    try {
      await logAction({
        userId: row.userId,
        username: row.user.username,
        action: 'password_reset_completed',
        entity: 'user',
        entityId: row.userId,
      })
    } catch {}

    return ok({ success: true })
  } catch (err) {
    console.error('[reset-password] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ')
  }
}
