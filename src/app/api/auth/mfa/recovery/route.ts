import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { setRoleCookie } from '@/lib/auth'
import { db } from '@/lib/db'
import { verifyMFAToken } from '@/lib/mfa-token'
import { rateLimit } from '@/lib/rate-limit'
import { markRecoveryCodeUsed, verifyRecoveryCode } from '@/lib/recovery-codes'

// POST /api/auth/mfa/recovery — Phase 4B: token-bound recovery-code login.
//
// The raw-`userId` path was an enumeration oracle (any caller could probe
// arbitrary accounts' recovery state). Now the ONLY accepted identity is the
// short-lived MFA challenge token (10-min HS256 JWT, purpose-bound) issued
// during an in-progress login — possession of the token proves the caller
// already passed the first factor for exactly this account. No new model or
// emailed token needed: the challenge token IS the secure recovery token.
// Rate limited (3/hour/IP) + every attempt audited.
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 3, window: 3600, keyPrefix: 'auth:mfa-recovery' })
    if (!rl.success) {
      return rateLimited('عدد كبير من محاولات الاسترداد، حاول مرة أخرى لاحقاً')
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const body = await req.json().catch(() => null)
    const mfaToken = typeof body?.mfaToken === 'string' ? body.mfaToken : ''
    const code = typeof body?.code === 'string' ? body.code : ''

    // A caller-supplied userId is NEVER trusted (enumeration oracle).
    if (!mfaToken || !code) {
      return validationFail({ message: 'بيانات غير مكتملة' })
    }

    const tokenData = await verifyMFAToken(mfaToken)
    if (!tokenData) {
      return validationFail({ message: 'انتهت صلاحية جلسة التحقق — ابدأ تسجيل الدخول من جديد' })
    }
    const targetUserId = tokenData.userId

    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        username: true,
        role: true,
        tokenVersion: true,
        onboardingCompleted: true,
        recoveryCodes: true,
        recoveryCodesUsed: true,
      },
    })

    if (!user || !user.recoveryCodes) {
      return validationFail({ message: 'لا توجد رموز استرداد لهذا الحساب' })
    }

    const usedIndices = (user.recoveryCodesUsed as number[]) || []
    const result = verifyRecoveryCode(code, user.recoveryCodes, usedIndices)

    if (!result.valid) {
      try {
        await logAction({
          userId: user.id,
          username: user.username,
          action: 'mfa_recovery_failed',
          entity: 'user',
          entityId: user.id,
          request: req,
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }
      return validationFail({ message: 'رمز الاسترداد غير صالح أو مستخدم مسبقاً' })
    }

    const newUsedIndices = markRecoveryCodeUsed(usedIndices, result.index)

    await db.user.update({
      where: { id: user.id },
      data: { recoveryCodesUsed: newUsedIndices },
    })

    try {
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'mfa_recovery_used',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ remainingCodes: 10 - newUsedIndices.length }),
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    // بعد التحقق، نسجل الدخول مع MFA موثق
    await setRoleCookie(user.id, user.role as never, user.tokenVersion, true, user.onboardingCompleted)

    return ok({ success: true, remainingCodes: 10 - newUsedIndices.length })
  } catch (err) {
    console.error('[mfa recovery] failed:', err)
    return internalError('حدث خطأ أثناء التحقق')
  }
}
