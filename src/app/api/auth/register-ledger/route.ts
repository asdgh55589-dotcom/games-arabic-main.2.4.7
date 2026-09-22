import type { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

// POST /api/auth/register-ledger — DISABLED by owner decision.
// Manual email signup is off — Google OAuth only (users are created in
// /api/auth/callback with emailVerified=true). This stub blocks direct
// Supabase signUp clients from minting Neon ledger rows.
export async function POST(_req: NextRequest) {
  return fail(
    'LOGIN_METHOD_DISABLED',
    'التسجيل اليدوي معطّل — سجّل الدخول عبر Google',
    410,
  )
}
