import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

// POST /api/auth/telegram/callback — DISABLED by owner decision.
// Telegram widget login is off — Google OAuth only.
export async function POST(_req: NextRequest) {
  return fail(
    'LOGIN_METHOD_DISABLED',
    'تسجيل الدخول عبر Telegram معطّل — سجّل الدخول عبر Google',
    410,
  )
}
