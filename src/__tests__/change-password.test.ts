/**
 * Change-password gate (E2E verification pass).
 *
 * - wrong current password → 422, nothing changes, sessions untouched
 * - correct current password → 200, other sessions invalidated, current kept
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

const mockInvalidate = jest.fn()
const mockSetRole = jest.fn()
jest.mock('@/lib/auth', () => ({
  invalidateUserSessions: (...a: Array<never>) => mockInvalidate(...a),
  setRoleCookie: (...a: Array<never>) => mockSetRole(...a),
}))

const mockDbUser = { findFirst: jest.fn(), findUnique: jest.fn() }
jest.mock('@/lib/db', () => ({ db: { user: mockDbUser } }))

const mockSignIn = jest.fn()
const mockUpdateUser = jest.fn()
const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockSbGetUser, signInWithPassword: mockSignIn, updateUser: mockUpdateUser },
  })),
}))

import { POST as changePOST } from '@/app/api/auth/change-password/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 300
function changeReq(body: unknown) {
  ip += 1
  return new NextRequest('http://x/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.77.0.${ip}` },
    body: JSON.stringify(body),
  })
}

const NEON = {
  id: 'u-3', username: 'chg', role: 'member', tokenVersion: 4,
  email: 'c@m.io', onboardingCompleted: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-3', email: 'c@m.io' } } })
  mockDbUser.findFirst.mockResolvedValue(NEON)
  mockDbUser.findUnique.mockResolvedValue({ totpEnabled: false })
  mockInvalidate.mockResolvedValue(5)
})

describe('POST /api/auth/change-password gate', () => {
  it('wrong current password → 422, sessions untouched', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
    const res = await changePOST(
      changeReq({ currentPassword: 'wrong-pass-1', newPassword: 'brand-new-pass-2' }),
    )
    expect(res.status).toBe(422)
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  it('correct current password → 200, other sessions die, current re-issued', async () => {
    mockSignIn.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const res = await changePOST(
      changeReq({ currentPassword: 'old-correct-1', newPassword: 'brand-new-pass-2' }),
    )
    expect(res.status).toBe(200)
    expect(mockInvalidate).toHaveBeenCalledWith('u-3')
    expect(mockSetRole).toHaveBeenCalledWith('u-3', 'member', 5, expect.anything(), true)
  })
})
