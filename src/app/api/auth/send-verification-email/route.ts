import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
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
      return new Response(JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...rateLimitHeaders(rl) },
      })
    }
  } catch {
    // fail-open
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
      return NextResponse.json({ error: error.message, code: 'RESEND_FAILED' }, { status: 500 })
    }
    return ok({ sent: true })
  } catch (err) {
    console.error('[send-verification-email] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ')
  }
}
