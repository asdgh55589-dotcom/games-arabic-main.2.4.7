/**
 * POST /api/auth/register-ledger — DISABLED by owner decision.
 *
 * Manual email signup is off — Google OAuth only. Every request answers
 * 410 LOGIN_METHOD_DISABLED without touching the database or rate limiter.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

import { POST as registerPOST } from '@/app/api/auth/register-ledger/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function regReq(body: unknown) {
  return new NextRequest('http://x/api/auth/register-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.200.11.9' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/register-ledger disabled', () => {
  it('rejects valid signup bodies with 410', async () => {
    const res = await registerPOST(
      regReq({ supabaseId: 'sb-1', username: 'reguser1', email: 'user1@example.com' }),
    )
    expect(res.status).toBe(410)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('LOGIN_METHOD_DISABLED')
  })

  it('rejects invalid bodies with 410 (no validation oracle)', async () => {
    const res = await registerPOST(regReq({ username: 'x' }))
    expect(res.status).toBe(410)
  })
})
