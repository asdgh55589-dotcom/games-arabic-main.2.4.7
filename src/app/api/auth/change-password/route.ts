import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ok, unauthorized, validationFail, internalError } from '@/lib/api-response'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

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
    const { password } = body

    if (!password || password.length < 6) {
      return validationFail({ password: 'Password must be at least 6 characters' })
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return validationFail({ password: error.message })
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[change-password POST] failed:', err)
    return internalError('Failed')
  }
}
