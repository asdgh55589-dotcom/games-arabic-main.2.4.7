import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

const DISABLED = () =>
  fail(
    'LOGIN_METHOD_DISABLED',
    'تسجيل الدخول عبر Telegram معطّل — سجّل الدخول عبر Google',
    410,
  )

// /api/auth/telegram — DISABLED by owner decision (login entry points only).
// The bot webhook (updates/notifications) is untouched; only the login
// session creation (POST) and completion (GET) are stubbed out.
export async function POST(_req: NextRequest) {
  return DISABLED()
}

export async function GET(_req: NextRequest) {
  return DISABLED()
}
