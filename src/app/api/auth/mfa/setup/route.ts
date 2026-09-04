import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError, validationFail, unauthorized } from '@/lib/api-response'
import { generateTOTPSecret, generateTOTPUri, generateQRCode, encryptTOTPSecret } from '@/lib/totp'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, email: true, totpEnabled: true },
    })

    if (!user) {
      return unauthorized()
    }

    if (user.totpEnabled) {
      return validationFail({ message: 'المصادقة الثنائية مفعلة بالفعل' })
    }

    const secret = generateTOTPSecret()
    const uri = generateTOTPUri(secret, user.email)
    const qrCode = await generateQRCode(uri)

    await db.user.update({
      where: { id: user.id },
      data: {
        totpSecret: encryptTOTPSecret(secret),
        totpEnabled: false,
      },
    })

    return ok({ secret, qrCode, uri })
  } catch (err) {
    console.error('[mfa setup] failed:', err)
    return internalError('حدث خطأ أثناء الإعداد')
  }
}
