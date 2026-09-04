import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

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
