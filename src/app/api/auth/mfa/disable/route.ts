import bcrypt from 'bcryptjs'
import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { DisableMfaSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'
import { decryptTOTPSecret, verifyTOTP } from '@/lib/totp'

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:mfa-disable' })
    if (!rl.success) {
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    const body = await req.json().catch(() => null)
    const parsed = DisableMfaSchema.safeParse({
      password: typeof body?.password === 'string' ? body.password : undefined,
      totpCode: typeof body?.totpCode === 'string' ? body.totpCode : undefined,
    })
    if (!parsed.success) {
      return validationFail({ password: 'قدّم كلمة المرور أو رمز المصادقة' })
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        username: true,
        email: true,
        totpEnabled: true,
        totpSecret: true,
        password: true,
        supabaseId: true,
      },
    })

    if (!user || !user.totpEnabled) {
      return validationFail({ message: 'المصادقة الثنائية غير مفعلة' })
    }

    // Phase 4B step-up: a stolen session alone must not kill the second
    // factor. Password holders prove with the password; passwordless users
    // prove with a fresh TOTP code.
    const hasPassword = !!user.password || (!!user.supabaseId && !!user.email)
    let method: 'password' | 'totp' | null = null

    if (hasPassword) {
      const { password } = parsed.data
      if (!password) {
        return validationFail({ password: 'كلمة المرور مطلوبة لتعطيل المصادقة الثنائية' })
      }
      let valid = false
      if (user.password) {
        valid = await bcrypt.compare(password, user.password)
      } else if (user.supabaseId && user.email) {
        try {
          const supabase = await createClient()
          const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password,
          })
          valid = !error
        } catch {
          valid = false
        }
      }
      if (!valid) {
        return validationFail({ password: 'كلمة المرور غير صحيحة' })
      }
      method = 'password'
    } else {
      const { totpCode } = parsed.data
      if (!totpCode || !user.totpSecret) {
        return validationFail({ totpCode: 'رمز المصادقة مطلوب لتعطيل المصادقة الثنائية' })
      }
      let valid = false
      try {
        valid = verifyTOTP(totpCode, decryptTOTPSecret(user.totpSecret as string))
      } catch {
        valid = false
      }
      if (!valid) {
        return validationFail({ totpCode: 'رمز المصادقة غير صحيح' })
      }
      method = 'totp'
    }

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

    try {
      await logAction({
        userId: user.id,
        username: user.username,
        action: 'mfa_disabled',
        entity: 'user',
        entityId: user.id,
        details: JSON.stringify({ method }),
        request: req,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    // تحديث الكوكيز لإزالة mfaVerified
    const { setRoleCookie } = await import('@/lib/auth')
    await setRoleCookie(updatedUser.id, updatedUser.role as never, updatedUser.tokenVersion, false, updatedUser.onboardingCompleted)

    return ok({ success: true, message: 'تم تعطيل المصادقة الثنائية' })
  } catch (err) {
    console.error('[mfa disable] failed:', err)
    return internalError('حدث خطأ أثناء التعطيل')
  }
}
