import type { NextRequest } from 'next/server'
import { fail, ok, unauthorized, validationFail } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { encryptTOTPSecret, generateQRCode, generateTOTPSecret, generateTOTPUri } from '@/lib/totp'
import { logger } from '@/lib/logger'
import { handlePrismaError } from '@/lib/prisma-errors'

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
    logger.error('[mfa setup] failed:', err)
    const { message, status, code } = handlePrismaError(err)
    return fail(code, message, status)
  }
}
