import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

// GET /api/auth/telegram/poll — DISABLED by owner decision.
// Telegram login is off — Google OAuth only.
export async function GET(_req: NextRequest) {
  return fail(
    'LOGIN_METHOD_DISABLED',
    'تسجيل الدخول عبر Telegram معطّل — سجّل الدخول عبر Google',
    410,
  )
}
