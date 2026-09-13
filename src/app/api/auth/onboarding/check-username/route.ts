import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { UsernameSchema } from '@/lib/schemas'
import { generateUniqueUsername } from '@/lib/username-generator'

// GET /api/auth/onboarding/check-username?username=... — D.6-b1
// Real-time availability for the onboarding username step.
export async function GET(req: NextRequest) {
  // Loose limit: typing fires many requests (fail-open on limiter error)
  try {
    const rl = await rateLimit(req, { limit: 30, window: 60, keyPrefix: 'auth:check-username' })
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
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const { searchParams } = new URL(req.url)
    const raw = (searchParams.get('username') || '').trim()
    if (!raw) {
      return validationFail({ username: 'اسم المستخدم مطلوب' })
    }

    const parsed = UsernameSchema.safeParse(raw)
    if (!parsed.success) {
      return validationFail({ username: parsed.error.issues[0]?.message || 'اسم مستخدم غير صالح' })
    }
    const username = parsed.data

    // Keeping your own current username is always fine
    if (session.username && session.username.toLowerCase() === username.toLowerCase()) {
      return ok({ available: true, username })
    }

    const existing = await db.user.findUnique({
      where: { username },
      select: { id: true },
    })
    if (!existing) {
      return ok({ available: true, username })
    }

    const suggestion = await generateUniqueUsername(username)
    return ok({ available: false, username, suggestion })
  } catch (err) {
    console.error('[check-username] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ')
  }
}
