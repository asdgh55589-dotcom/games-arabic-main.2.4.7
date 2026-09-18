import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAuth, setRoleCookie, type UserRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { UsernameSchema } from '@/lib/schemas'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/auth/onboarding/complete — D.6-b3: verify readiness, flip the
// flag, re-issue ga_admin_role with ob:true.
export async function POST(_req?: NextRequest) {
  try {
    const rl = await rateLimit(_req as NextRequest, {
      limit: 10,
      window: 60,
      keyPrefix: 'auth:onboarding-complete',
    }).catch(() => null)
    if (rl && !rl.success) {
      return rateLimited()
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const neonUser = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        supabaseId: true,
        role: true,
        tokenVersion: true,
        onboardingCompleted: true,
      },
    })
    if (!neonUser) return unauthorized()

    // Non-members (grandfathered staff/creators) skip checks — just refresh cookie.
    if (neonUser.role !== 'member') {
      await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion, false, true)
      return ok({ user: { id: neonUser.id, onboardingCompleted: true } })
    }

    if (neonUser.onboardingCompleted) {
      await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion, false, true)
      return ok({ user: { id: neonUser.id, onboardingCompleted: true }, already: true })
    }

    // 1. Username must be valid (chosen or auto-generated-but-sane).
    if (UsernameSchema.safeParse(neonUser.username).success === false) {
      return validationFail({ username: 'اختر اسم مستخدم صالحاً أولاً' })
    }

    // 2. Profile must be confirmed (displayName set by PATCH step 1).
    if (!neonUser.displayName || !neonUser.displayName.trim()) {
      return validationFail({ displayName: 'أكّد بيانات حسابك أولاً' })
    }

    // 3. A password credential must exist (Supabase identities include email).
    if (!neonUser.supabaseId) {
      return validationFail({ password: 'أنشئ كلمة مرور أولاً' })
    }
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'خدمة الحسابات غير متاحة حالياً', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      )
    }
    const { data: supaData, error: supaError } = await admin.auth.admin.getUserById(
      neonUser.supabaseId,
    )
    const identities = (supaData?.user as { identities?: { provider?: string }[] } | null)
      ?.identities
    const providers =
      (supaData?.user as { app_metadata?: { providers?: string[] } } | null)?.app_metadata
        ?.providers || []
    const hasEmailCredential =
      !supaError &&
      (identities?.some((i) => i?.provider === 'email') || providers.includes('email'))
    if (!hasEmailCredential) {
      return validationFail({ password: 'أنشئ كلمة مرور أولاً' })
    }

    const updated = await db.user.update({
      where: { id: neonUser.id },
      data: { onboardingCompleted: true },
      select: { id: true, username: true, role: true, tokenVersion: true },
    })

    await setRoleCookie(updated.id, updated.role as UserRole, updated.tokenVersion, false, true)

    try {
      await logAction({
        userId: neonUser.id,
        username: updated.username,
        action: 'onboarding_completed',
        entity: 'user',
        entityId: neonUser.id,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({ user: { id: updated.id, username: updated.username, onboardingCompleted: true } })
  } catch (err) {
    console.error('[onboarding complete] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ')
  }
}
