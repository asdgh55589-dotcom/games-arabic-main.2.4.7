import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { invalidateUserSessions, setRoleCookie } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ChangePasswordSchema } from '@/lib/schemas'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Rate limiting: 5 attempts per 60 seconds
  const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:change-password' })
  if (!rl.success) {
    return rateLimited()
  }

  try {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return unauthorized()
    }

    const body = await req.json()
    const parsed = ChangePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { newPassword: password, currentPassword } = parsed.data

    // تحقق من كلمة المرور الحالية عبر محاولة تسجيل دخول صامتة
    if (supabaseUser.email) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: supabaseUser.email,
        password: currentPassword,
      })
      if (signInError) {
        return validationFail({ currentPassword: 'كلمة المرور الحالية غير صحيحة' })
      }
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return validationFail({ password: error.message })
    }

    // CRITICAL: إبطال كل الجلسات الأخرى — يجبر كل الأجهزة الأخرى على إعادة التسجيل
    try {
      // البحث عن المستخدم في Neon عبر Supabase ID أو البريد
      let neonUser = null as {
        id: string
        username: string
        role: string
        tokenVersion: number
        email: string
        onboardingCompleted: boolean
      } | null
      try {
        neonUser = await db.user.findFirst({
          where: {
            OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
          },
          select: { id: true, username: true, role: true, tokenVersion: true, email: true, onboardingCompleted: true },
        })
      } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: DB lookup fallback, will use Supabase user
      }

      if (neonUser) {
        const newTokenVersion = await invalidateUserSessions(neonUser.id)

        // إعادة إصدار الكوكي للجلسة الحالية فقط — يبقى المستخدم الحالي مسجلاً
        // إذا كان MFA مفعلاً، نحتاج إلى الحفاظ على حالة التحقق
        if (newTokenVersion !== -1) {
          try {
            const fullUser = await db.user.findUnique({
              where: { id: neonUser.id },
              select: { totpEnabled: true },
            })
            const mfaVerified = !!fullUser?.totpEnabled
            await setRoleCookie(neonUser.id, neonUser.role as never, newTokenVersion, mfaVerified, neonUser.onboardingCompleted)
          } catch (e) {
            logger.error({ err: e }, '[ChangePassword] setRoleCookie failed')
          }
        }

        // سجل تدقيق
        try {
          await logAction({
            userId: neonUser.id,
            username: neonUser.username,
            action: 'password_changed',
            entity: 'user',
            entityId: neonUser.id,
            details: JSON.stringify({
              username: neonUser.username,
              allOtherSessionsInvalidated: true,
            }),
          })
        } catch {
        // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
      }
      }
    } catch (e) {
      logger.error({ err: e }, '[ChangePassword] session invalidation failed')
      // لا نفشل الطلب — تغيير كلمة المرور نجح حتى لو فشل الإبطال
    }

    return ok({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (err) {
    logger.error({ err }, '[change-password POST] failed')
    return internalError('حدث خطأ، حاول مجدداً')
  }
}
