import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { setRoleCookie } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  clearMfaFailures,
  isMfaLocked,
  MFA_LOCKED_MESSAGE,
  MFA_MAX_ATTEMPTS,
  recordMfaFailure,
} from '@/lib/mfa-defense'
import { verifyMFAToken } from '@/lib/mfa-token'
import { decryptTOTPSecret, verifyTOTP } from '@/lib/totp'

export async function POST(req: NextRequest) {
  try {
    const { mfaToken, code } = await req.json()

    if (!mfaToken || !code) {
      return validationFail({ message: 'بيانات غير مكتملة' })
    }

    const tokenData = await verifyMFAToken(mfaToken)
    if (!tokenData) {
      return validationFail({ message: 'انتهت صلاحية الجلسة، حاول تسجيل الدخول مرة أخرى' })
    }

    const user = await db.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        role: true,
        totpSecret: true,
        tokenVersion: true,
        totpEnabled: true,
        onboardingCompleted: true,
        username: true,
      },
    })

    if (!user || !user.totpSecret || !user.totpEnabled) {
      return validationFail({ message: 'المستخدم غير موجود أو MFA غير مفعل' })
    }

    // Per-account MFA lockout (5 failures within the 10m token window).
    if (await isMfaLocked(user.id)) {
      return rateLimited(MFA_LOCKED_MESSAGE, 60)
    }

    const secret = decryptTOTPSecret(user.totpSecret)
    const valid = verifyTOTP(code, secret)

    if (!valid) {
      const attempts = await recordMfaFailure(user.id)
      const remaining = Math.max(0, MFA_MAX_ATTEMPTS - attempts)

      // Log failed attempt (best-effort).
      try {
        const { logAction } = await import('@/lib/audit')
        await logAction({
          userId: user.id,
          username: user.username || 'unknown',
          action: 'mfa_login_failed',
          entity: 'user',
          entityId: user.id,
          details: JSON.stringify({ remaining }),
          request: req,
        })
      } catch {
        // best-effort audit logging — never block the response on it
      }

      return validationFail({
        message: 'رمز التحقق غير صحيح',
        remainingAttempts: remaining,
      })
    }

    // Successful verification — clear failures and complete login.
    await clearMfaFailures(user.id)

    await setRoleCookie(
      user.id,
      user.role as never,
      user.tokenVersion,
      true,
      user.onboardingCompleted,
    )

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    // Phase 4C: feeds "last MFA verification" in settings (best-effort).
    try {
      const { logAction } = await import('@/lib/audit')
      await logAction({
        userId: user.id,
        username: user.username || 'unknown',
        action: 'mfa_login_success',
        entity: 'user',
        entityId: user.id,
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ success: true })
  } catch (err) {
    logger.error('[mfa login] failed:', err)
    return internalError('حدث خطأ أثناء التحقق')
  }
}
