import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { setRoleCookie } from '@/lib/auth'
import { db } from '@/lib/db'
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
      select: { id: true, role: true, totpSecret: true, tokenVersion: true, totpEnabled: true },
    })

    if (!user || !user.totpSecret || !user.totpEnabled) {
      return validationFail({ message: 'المستخدم غير موجود أو MFA غير مفعل' })
    }

    const secret = decryptTOTPSecret(user.totpSecret)

    if (!verifyTOTP(code, secret)) {
      return validationFail({ message: 'رمز التحقق غير صحيح' })
    }

    await setRoleCookie(user.id, user.role as never, user.tokenVersion, true)

    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    return ok({ success: true })
  } catch (err) {
    console.error('[mfa login] failed:', err)
    return internalError('حدث خطأ أثناء التحقق')
  }
}
