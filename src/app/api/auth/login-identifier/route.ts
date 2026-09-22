import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

// POST /api/auth/login-identifier — DISABLED by owner decision.
// Manual (username/email + password) login is off — Google OAuth only.
// The login UI no longer offers this method; this stub keeps old clients
// from authenticating through a hidden endpoint.
export async function POST(_req: NextRequest) {
  return fail(
    'LOGIN_METHOD_DISABLED',
    'تسجيل الدخول اليدوي معطّل — سجّل الدخول عبر Google',
    410,
  )
}
