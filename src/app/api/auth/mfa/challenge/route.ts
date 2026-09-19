import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { generateMFAToken } from '@/lib/mfa-token'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/mfa/challenge — Phase 4C: mint an MFA challenge token for a
// Supabase-authed user (client-side email login path).
//
// The username/identifier path gets its challenge inline from
// POST /api/auth/login-identifier; the Supabase client-side path cannot, so
// it calls here AFTER Supabase sign-in: if the account has TOTP enabled, the
// client must sign out of Supabase immediately and complete
// POST /api/auth/mfa/login — otherwise the Supabase session would bypass MFA
// for tokenVersion=0 accounts. No TOTP → 404-style "not enabled" (the client
// proceeds with normal login).
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:mfa-challenge' })
    if (!rl.success) {
      return rateLimited()
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    let neonId: string | null = null
    try {
      const supabase = await createClient()
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser()
      if (sbUser) {
        const u = await db.user.findFirst({
          where: { OR: [{ supabaseId: sbUser.id }, { email: sbUser.email || '' }] },
          select: { id: true },
        })
        neonId = u?.id ?? null
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: no Supabase session → unauthorized below
    }
    if (!neonId) return unauthorized()

    const user = await db.user.findUnique({
      where: { id: neonId },
      select: { id: true, username: true, totpEnabled: true, totpSecret: true, recoveryCodesUsed: true },
    })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return validationFail({ message: 'المصادقة الثنائية غير مفعلة' })
    }

    const mfaToken = await generateMFAToken(user.id)
    const used = Array.isArray(user.recoveryCodesUsed)
      ? (user.recoveryCodesUsed as unknown[]).length
      : 0

    try {
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'mfa_challenge_issued',
        entity: 'user',
        entityId: user.id,
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ mfaRequired: true, mfaToken, recoveryCodesCount: Math.max(0, 10 - used) })
  } catch (err) {
    console.error('[mfa challenge] failed:', err)
    return internalError('حدث خطأ')
  }
}
