/**
 * Fix 2 (Phase 4A): GET /api/auth/session-ledger must identify the current
 * session SERVER-SIDE via the httpOnly ga_session_ledger cookie.
 *
 * The old UI read document.cookie for an httpOnly cookie (always null) and
 * fell back to "newest = current" — revoke-others could kill the real
 * session. These tests pin: currentSessionId === row id matching the
 * presented cookie token, null when unknown.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockFindFirst = jest.fn()
const mockFindMany = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findFirst: (...a: Array<never>) => mockFindFirst(...a) } },
}))
// session-ledger lib uses db.session — attach after mock creation
import { db } from '@/lib/db'
;(db as any).session = { findMany: (...a: Array<never>) => mockFindMany(...a) }

const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: mockSbGetUser } })),
}))

import { GET as sessionsGET } from '@/app/api/auth/session-ledger/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function getReq(cookie?: string) {
  const headers: Record<string, string> = { 'x-forwarded-for': '10.9.0.1' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://x/api/auth/session-ledger', { method: 'GET', headers })
}

const ROWS = [
  { id: 's-1', token: 'tok-aaa', userId: 'u-9', expiresAt: new Date(Date.now() + 3600e3) },
  { id: 's-2', token: 'tok-bbb', userId: 'u-9', expiresAt: new Date(Date.now() + 3600e3) },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-9', email: 's@s.io' } } })
  mockFindFirst.mockResolvedValue({ id: 'u-9' })
  mockFindMany.mockResolvedValue(ROWS)
})

describe('GET /api/auth/session-ledger currentSessionId', () => {
  it('returns the row id matching the presented ledger cookie', async () => {
    const res = await sessionsGET(getReq('ga_session_ledger=tok-bbb'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.currentSessionId).toBe('s-2')
    expect(body.data).toHaveLength(2)
  })

  it('returns null when no ledger cookie is presented (never guesses)', async () => {
    const res = await sessionsGET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.currentSessionId).toBeNull()
  })

  it('returns null when the cookie matches no row (stale/foreign token)', async () => {
    const res = await sessionsGET(getReq('ga_session_ledger=tok-unknown'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.currentSessionId).toBeNull()
  })
})
