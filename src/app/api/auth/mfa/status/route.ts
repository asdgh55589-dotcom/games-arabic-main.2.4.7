import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, unauthorized, internalError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        totpEnabled: true,
        webauthnCredentials: true,
        recoveryCodes: true,
        recoveryCodesUsed: true,
      },
    })

    if (!user) {
      return unauthorized()
    }

    const webauthnEnabled = !!(
      user.webauthnCredentials &&
      Array.isArray(user.webauthnCredentials) &&
      (user.webauthnCredentials as unknown[]).length > 0
    )

    const recoveryCodesRemaining = user.recoveryCodes
      ? 10 - ((user.recoveryCodesUsed as number[])?.length || 0)
      : 0

    return ok({
      totpEnabled: !!user.totpEnabled,
      webauthnEnabled,
      recoveryCodesRemaining,
    })
  } catch (err) {
    console.error('[mfa status] failed:', err)
    return internalError('حدث خطأ')
  }
}
