import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { encryptRecoveryCodes, generateRecoveryCodes } from '@/lib/recovery-codes'
import { decryptTOTPSecret, verifyTOTP } from '@/lib/totp'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return validationFail({ message: 'رمز التحقق مطلوب' })
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, totpSecret: true, totpEnabled: true },
    })

    if (!user || !user.totpSecret) {
      return validationFail({ message: 'لم يتم إعداد المصادقة الثنائية' })
    }

    const secret = decryptTOTPSecret(user.totpSecret)

    if (!verifyTOTP(token, secret)) {
      return validationFail({ message: 'رمز التحقق غير صحيح' })
    }

    const recoveryCodes = generateRecoveryCodes()

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        mfaEnabledAt: new Date(),
        recoveryCodes: encryptRecoveryCodes(recoveryCodes),
        recoveryCodesUsed: [],
      },
      select: { id: true, role: true, tokenVersion: true, onboardingCompleted: true },
    })

    // تحديث الكوكيز ليحتوي على mfaVerified = true
    const { setRoleCookie } = await import('@/lib/auth')
    await setRoleCookie(updatedUser.id, updatedUser.role as never, updatedUser.tokenVersion, true, updatedUser.onboardingCompleted)

    return ok({ success: true, recoveryCodes })
  } catch (err) {
    console.error('[mfa verify] failed:', err)
    return internalError('حدث خطأ أثناء التحقق')
  }
}
