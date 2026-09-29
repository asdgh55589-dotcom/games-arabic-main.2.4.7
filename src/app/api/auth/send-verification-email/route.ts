import type { NextRequest } from 'next/server'
import { fail, internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { EmailSchema } from '@/lib/schemas'
import { createClient } from '@/lib/supabase/server'

// POST /api/auth/send-verification-email — D.6-c fix for the dead reference
// called by views/login.tsx handleResend fallback. Server-side resend with
// rate limiting; honest status (the caller throws the original Supabase error
// when this responds !ok).
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 600, keyPrefix: 'auth:resend-verify' })
    if (!rl.success) {
      return rateLimited()
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || EmailSchema.safeParse(email).success === false) {
      return validationFail({ email: 'البريد الإلكتروني غير صحيح' })
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: '/verify-email' },
    })
    if (error) {
      logger.error({ err: error, route: 'POST /api/auth/send-verification-email' }, 'Verification email resend failed')
      return fail('RESEND_FAILED', 'تعذر إرسال رسالة التحقق. حاول مرة أخرى لاحقاً.', 500)
    }
    return ok({ sent: true })
  } catch (err) {
    logger.error({ err, route: 'POST /api/auth/send-verification-email' }, 'Verification email resend failed')
    return internalError('حدث خطأ')
  }
}
