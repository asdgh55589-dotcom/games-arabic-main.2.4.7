import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

const RegisterLedgerSchema = z.object({
  supabaseId: z.string().min(1),
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  displayName: z.string().max(50).optional(),
  email: z.string().email(),
})

// Phase 4A: 5 registrations/hour/IP + 3/hour per (IP, email domain).
// The domain cap is deliberately IP-scoped (not global) so one abuser
// can't deny gmail.com to everyone — it stops a single IP mass-minting
// accounts on one domain.
const REGISTER_IP_LIMIT = 5
const REGISTER_DOMAIN_LIMIT = 3
const REGISTER_WINDOW_SECONDS = 3600
const REGISTER_LIMIT_MESSAGE = 'عدد كبير من محاولات التسجيل، حاول مرة أخرى لاحقاً'

function limited(limit: number, resetAt: number, retryAfterSeconds: number) {
  return NextResponse.json(
    { error: REGISTER_LIMIT_MESSAGE, code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders({ success: false, remaining: 0, resetAt, limit }),
        'Retry-After': String(Math.max(1, Math.floor(retryAfterSeconds))),
      },
    },
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const parsed = RegisterLedgerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { supabaseId, username, displayName, email } = parsed.data

    const ipRl = await rateLimit(req, {
      limit: REGISTER_IP_LIMIT,
      window: REGISTER_WINDOW_SECONDS,
      keyPrefix: 'auth:register',
    })
    if (!ipRl.success) {
      return limited(
        REGISTER_IP_LIMIT,
        ipRl.resetAt,
        Math.ceil((ipRl.resetAt - Date.now()) / 1000),
      )
    }

    const domain = String(email).split('@')[1]?.toLowerCase() || 'unknown'
    const domainRl = await rateLimit(req, {
      limit: REGISTER_DOMAIN_LIMIT,
      window: REGISTER_WINDOW_SECONDS,
      keyPrefix: `auth:register-domain:${domain}`,
    })
    if (!domainRl.success) {
      return limited(
        REGISTER_DOMAIN_LIMIT,
        domainRl.resetAt,
        Math.ceil((domainRl.resetAt - Date.now()) / 1000),
      )
    }
    // تحقق تفرد username
    const existing = await db.user.findUnique({ where: { username } })
    if (existing && existing.supabaseId !== supabaseId) {
      return NextResponse.json({ error: 'USERNAME_TAKEN', code: 'USERNAME_TAKEN' }, { status: 409 })
    }
    const emailLower = String(email).toLowerCase()
    // upsert
    const user = await db.user.upsert({
      where: { supabaseId },
      create: {
        supabaseId,
        username,
        displayName: displayName || username,
        email: emailLower,
        emailVerified: false,
        role: 'member',
      },
      update: {
        username,
        displayName: displayName || username,
        email: emailLower,
      },
      select: { id: true, username: true },
    })
    return NextResponse.json({ data: user })
  } catch (err) {
    logger.error({ err }, '[register-ledger] failed')
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
