import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { verifyRecoveryCode, markRecoveryCodeUsed } from '@/lib/recovery-codes'
import { ok, validationFail, internalError } from '@/lib/api-response'
import { setRoleCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { userId, code, mfaToken } = await req.json()

    // نحتاج إما userId مباشر أو mfaToken للتحقق
    let targetUserId = userId as string | undefined

    if (!targetUserId && mfaToken) {
      const { verifyMFAToken } = await import('@/lib/mfa-token')
      const tokenData = await verifyMFAToken(mfaToken)
      if (tokenData) {
        targetUserId = tokenData.userId
      }
    }

    if (!targetUserId || !code) {
      return validationFail({ message: 'بيانات غير مكتملة' })
    }

    const user = await db.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        tokenVersion: true,
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
      return validationFail({ message: 'رمز الاسترداد غير صالح أو مستخدم مسبقاً' })
    }

    const newUsedIndices = markRecoveryCodeUsed(usedIndices, result.index)

    await db.user.update({
      where: { id: user.id },
      data: { recoveryCodesUsed: newUsedIndices },
    })

    // بعد التحقق، نسجل الدخول مع MFA موثق
    await setRoleCookie(user.id, user.role as never, user.tokenVersion, true)

    return ok({ success: true, remainingCodes: 10 - newUsedIndices.length })
  } catch (err) {
    console.error('[mfa recovery] failed:', err)
    return internalError('حدث خطأ أثناء التحقق')
  }
}
