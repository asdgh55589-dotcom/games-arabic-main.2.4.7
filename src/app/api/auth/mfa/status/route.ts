import { internalError, ok, unauthorized } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function buildStatus(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      totpEnabled: true,
      mfaEnabledAt: true,
      webauthnCredentials: true,
      recoveryCodes: true,
      recoveryCodesUsed: true,
    },
  })

  if (!user) {
    return null
  }

  const webauthnEnabled = !!(
    user.webauthnCredentials &&
    Array.isArray(user.webauthnCredentials) &&
    (user.webauthnCredentials as unknown[]).length > 0
  )

  const recoveryCodesRemaining = user.recoveryCodes
    ? 10 - ((user.recoveryCodesUsed as number[])?.length || 0)
    : 0

  // Last successful MFA verification (Phase 4C) — best-effort, null when never.
  let lastMfaLoginAt: string | null = null
  try {
    const last = await db.auditLog.findFirst({
      where: { userId, action: 'mfa_login_success' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    lastMfaLoginAt = last ? new Date(last.createdAt).toISOString() : null
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort enrichment
  }

  return {
    totpEnabled: !!user.totpEnabled,
    mfaEnabledAt: user.mfaEnabledAt ? new Date(user.mfaEnabledAt as unknown as string).toISOString() : null,
    lastMfaLoginAt,
    webauthnEnabled,
    recoveryCodesRemaining,
  }
}

export async function GET() {
  try {
    // Phase 4C: Supabase session fallback so the client-side email login can
    // check MFA status (mirrors session-ledger GET dual-auth).
    try {
      const supabase = await createClient()
      const {
        data: { user: sbUser },
      } = await supabase.auth.getUser()
      if (sbUser) {
        const u = await db.user.findFirst({
          where: { OR: [{ supabaseId: sbUser.id }, { email: sbUser.email || '' }] },
          select: { id: true },
        })
        if (u) {
          const status = await buildStatus(u.id)
          if (status) return ok(status)
        }
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Supabase fallback, try role cookie next
    }

    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const status = await buildStatus(session.id)
    if (!status) {
      return unauthorized()
    }

    return ok(status)
  } catch (err) {
    console.error('[mfa status] failed:', err)
    return internalError('حدث خطأ')
  }
}
