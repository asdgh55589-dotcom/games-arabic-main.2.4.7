import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, totpEnabled: true },
    })

    if (!user || !user.totpEnabled) {
      return validationFail({ message: 'المصادقة الثنائية غير مفعلة' })
    }

    // في الإنتاج يجب التحقق من كلمة المرور — حالياً نسمح بالتعطيل مباشرة للمشرفين
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        totpSecret: null as any,
        totpEnabled: false,
        recoveryCodes: null as any,
        recoveryCodesUsed: [] as any,
        mfaEnabledAt: null as any,
        webauthnCredentials: null as any,
      },
      select: { id: true, role: true, tokenVersion: true, onboardingCompleted: true },
    })

    // تحديث الكوكيز لإزالة mfaVerified
    const { setRoleCookie } = await import('@/lib/auth')
    await setRoleCookie(updatedUser.id, updatedUser.role as never, updatedUser.tokenVersion, false, updatedUser.onboardingCompleted)

    return ok({ success: true, message: 'تم تعطيل المصادقة الثنائية' })
  } catch (err) {
    console.error('[mfa disable] failed:', err)
    return internalError('حدث خطأ أثناء التعطيل')
  }
}
