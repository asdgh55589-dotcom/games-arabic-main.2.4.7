/**
 * POST /api/auth/login-identifier — DISABLED by owner decision.
 *
 * Manual (username/email + password) login is off — Google OAuth only.
 * The route answers 410 LOGIN_METHOD_DISABLED for every request without
 * touching the database, so no credential can authenticate through it.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

import { POST as identifierPOST } from '@/app/api/auth/login-identifier/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function idReq(body: unknown) {
  return new NextRequest('http://x/api/auth/login-identifier', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('login-identifier disabled', () => {
  it('rejects valid-looking credentials with 410', async () => {
    const res = await identifierPOST(idReq({ identifier: 'someone', password: 'secret123' }))
    expect(res.status).toBe(410)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('LOGIN_METHOD_DISABLED')
  })

  it('rejects email identifiers with 410', async () => {
    const res = await identifierPOST(
      idReq({ identifier: 'user@mail.com', password: 'secret123' }),
    )
    expect(res.status).toBe(410)
  })

  it('rejects malformed bodies with 410 (no validation oracle)', async () => {
    const res = await identifierPOST(idReq({}))
    expect(res.status).toBe(410)
  })
})
