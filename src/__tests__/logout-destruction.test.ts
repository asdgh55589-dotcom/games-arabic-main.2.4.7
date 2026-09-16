/**
 * Logout destruction proof (E2E verification pass).
 *
 * RED phase — POST /api/auth/logout does not yet revoke the session
 * ledger or clear the ledger cookie, so the ledger tests fail until fixed.
 *
 * Contract:
 * - authed logout bumps tokenVersion (all role cookies die everywhere)
 * - authed logout deletes ALL ledger rows for the user (all devices)
 * - ledger cookie is cleared on the response (same path it was set with)
 * - Supabase signOut is called
 * - unauthenticated logout still revokes the presented ledger token
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

const mockRequireAuth = jest.fn()
const mockInvalidate = jest.fn()
const mockClearRole = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: Array<never>) => mockRequireAuth(...a),
  invalidateUserSessions: (...a: Array<never>) => mockInvalidate(...a),
  clearRoleCookie: (...a: Array<never>) => mockClearRole(...a),
}))

const mockSignOut = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { signOut: mockSignOut } })),
}))

const mockDeleteMany = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { session: { deleteMany: (...a: Array<never>) => mockDeleteMany(...a) } },
}))

const mockRevoke = jest.fn()
jest.mock('@/lib/session-ledger', () => ({
  revokeSession: (...a: Array<never>) => mockRevoke(...a),
}))

const mockLogAction = jest.fn()
jest.mock('@/lib/audit', () => ({ logAction: (...a: Array<never>) => mockLogAction(...a) }))

import { POST as logoutPOST } from '@/app/api/auth/logout/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function logoutReq(ledgerToken?: string) {
  return new NextRequest('http://x/api/auth/logout', {
    method: 'POST',
    headers: ledgerToken ? { cookie: `ga_session_ledger=${ledgerToken}` } : {},
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSignOut.mockResolvedValue({ error: null })
  mockDeleteMany.mockResolvedValue({ count: 2 })
})

describe('POST /api/auth/logout destruction', () => {
  it('destroys everything: tokenVersion + all ledger rows + both cookies + Supabase', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u-1', username: 'boss' })
    const res = await logoutPOST(logoutReq('led-current'))

    expect(mockInvalidate).toHaveBeenCalledWith('u-1')
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
    expect(mockClearRole).toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalled()

    const cleared = res.cookies.get('ga_session_ledger')
    expect(cleared).toBeDefined()
    expect(cleared?.value).toBe('')
  })

  it('unauthenticated logout still revokes the presented ledger token + clears cookie', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await logoutPOST(logoutReq('led-stale'))

    expect(mockRevoke).toHaveBeenCalledWith('led-stale')
    expect(res.cookies.get('ga_session_ledger')?.value).toBe('')
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('logout without any ledger cookie still succeeds', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'u-1', username: 'boss' })
    const res = await logoutPOST(logoutReq())
    expect(res.status).toBe(200)
    expect(mockDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u-1' } })
  })
})
