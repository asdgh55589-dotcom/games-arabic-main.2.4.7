import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { ok, unauthorized, validationFail, internalError } from '@/lib/api-response'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { invalidateUserSessions, setRoleCookie } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  // Rate limiting: 5 attempts per 60 seconds
  const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'auth:change-password' })
  if (!rl.success) {
    return new Response(
      JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) } }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user: supabaseUser } } = await supabase.auth.getUser()
    if (!supabaseUser) {
      return unauthorized()
    }

    const body = await req.json()
    const { password, currentPassword } = body

    if (!currentPassword) {
      return validationFail({ currentPassword: 'كلمة المرور الحالية مطلوبة' })
    }

    if (!password || password.length < 6) {
      return validationFail({ password: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' })
    }

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
      let neonUser = null as { id: string; username: string; role: string; tokenVersion: number; email: string } | null
      try {
        neonUser = await db.user.findFirst({
          where: {
            OR: [
              { supabaseId: supabaseUser.id },
              { email: supabaseUser.email || '' },
            ],
          },
          select: { id: true, username: true, role: true, tokenVersion: true, email: true },
        })
      } catch {}

      if (neonUser) {
        const newTokenVersion = await invalidateUserSessions(neonUser.id)

        // إعادة إصدار الكوكي للجلسة الحالية فقط — يبقى المستخدم الحالي مسجلاً
        if (newTokenVersion !== -1) {
          try {
            await setRoleCookie(neonUser.id, neonUser.role as never, newTokenVersion)
          } catch (e) {
            console.error('[ChangePassword] setRoleCookie failed:', e)
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
            details: JSON.stringify({ username: neonUser.username, allOtherSessionsInvalidated: true }),
          })
        } catch {}
      }
    } catch (e) {
      console.error('[ChangePassword] session invalidation failed:', e)
      // لا نفشل الطلب — تغيير كلمة المرور نجح حتى لو فشل الإبطال
    }

    return ok({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
  } catch (err) {
    console.error('[change-password POST] failed:', err)
    return internalError('Failed')
  }
}
