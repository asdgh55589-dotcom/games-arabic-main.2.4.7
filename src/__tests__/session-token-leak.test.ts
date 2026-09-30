/**
 * CRITICAL audit fix — session bearer tokens must NEVER appear in JSON bodies.
 * Tokens travel ONLY in the httpOnly ga_session_ledger cookie.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockFindFirst = jest.fn()
const mockSessionCreate = jest.fn()
const mockSessionFindUnique = jest.fn()
const mockSessionDeleteMany = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: { findFirst: (...a: Array<never>) => mockFindFirst(...a) },
  },
}))
import { db } from '@/lib/db'
;(db as any).session = {
  create: (...a: Array<never>) => mockSessionCreate(...a),
  findUnique: (...a: Array<never>) => mockSessionFindUnique(...a),
  deleteMany: (...a: Array<never>) => mockSessionDeleteMany(...a),
}

const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: mockSbGetUser } })),
}))
jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(async () => ({ id: 'u-9', role: 'member' })),
}))

import { DELETE as sessionsDELETE, POST as sessionsPOST } from '@/app/api/auth/session-ledger/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

beforeEach(() => {
  jest.clearAllMocks()
  mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-9', email: 's@s.io' } } })
  mockFindFirst.mockResolvedValue({ id: 'u-9' })
})

describe('session token never leaks into JSON', () => {
  it('POST strips the bearer from the body (cookie carries it)', async () => {
    mockSessionCreate.mockResolvedValue({
      id: 's-new',
      token: 'tok-SUPER-SECRET',
      userId: 'u-9',
      expiresAt: new Date(),
    })
    const req = new NextRequest('http://x/api/auth/session-ledger', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    })
    const res = await sessionsPOST(req)
    expect(res.status).toBe(200)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toContain('tok-SUPER-SECRET')
    // ...but the httpOnly cookie still carries it
    const setCookie = res.headers.get('set-cookie') || ''
    expect(setCookie).toContain('ga_session_ledger=tok-SUPER-SECRET')
    expect(setCookie).toMatch(/httponly/i)
  })

  it('DELETE revokes by row id (no token in URL or body)', async () => {
    mockSessionFindUnique.mockResolvedValue({ id: 's-1', userId: 'u-9', token: 'tok-aaa' })
    mockSessionDeleteMany.mockResolvedValue({ count: 1 })
    const req = new NextRequest('http://x/api/auth/session-ledger?id=s-1', { method: 'DELETE' })
    const res = await sessionsDELETE(req)
    expect(res.status).toBe(200)
    expect(mockSessionDeleteMany).toHaveBeenCalled()
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toContain('tok-aaa')
  })

  it('DELETE refuses cross-user ids and legacy token params', async () => {
    mockSessionFindUnique.mockResolvedValue({ id: 's-X', userId: 'u-other', token: 'tok-X' })
    const cross = await sessionsDELETE(
      new NextRequest('http://x/api/auth/session-ledger?id=s-X', { method: 'DELETE' }),
    )
    expect(cross.status).toBe(404)
    const legacy = await sessionsDELETE(
      new NextRequest('http://x/api/auth/session-ledger?token=tok-aaa', { method: 'DELETE' }),
    )
    expect(legacy.status).toBe(400)
    expect(mockSessionDeleteMany).not.toHaveBeenCalled()
  })
})
