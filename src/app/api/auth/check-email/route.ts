import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

// GET /api/auth/check-email?email=...
// يفحص هل البريد مسجّل بالفعل في Neon DB (لمنع التسجيل المكرر)
export async function GET(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 20, window: 60, keyPrefix: 'auth:check-email' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')?.trim().toLowerCase()

    if (!email) {
      return NextResponse.json({ available: false, error: 'email required' }, { status: 400 })
    }

    // فحص بسيط لصيغة البريد
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ available: false, error: 'صيغة بريد غير صحيحة' })
    }

    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    return NextResponse.json({
      available: !existing,
      email,
    })
  } catch (err) {
    console.error('[check-email] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
