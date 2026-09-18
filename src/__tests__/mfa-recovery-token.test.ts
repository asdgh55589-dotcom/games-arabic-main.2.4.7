/**
 * Fix 2 (Phase 4B): POST /api/auth/mfa/recovery is token-bound.
 *
 * Abuse case: raw userId in the body let anyone probe/reset MFA login for
 * arbitrary accounts. Now only a valid MFA challenge token (issued after
 * passing factor one) identifies the account.
 * - userId-only → 422 WITHOUT touching the DB (no oracle signal)
 * - forged/expired token → 422
 * - valid token + valid code → 200 + audit
 * - valid token + wrong code → 422 + failure audit
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest-4b'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockSetRoleCookie = jest.fn()
jest.mock('@/lib/auth', () => ({
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
}))

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...a: Array<never>) => mockFindUnique(...a), update: (...a: Array<never>) => mockUpdate(...a) } },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
const { logAction } = jest.requireMock('@/lib/audit') as { logAction: jest.Mock }

// Root __mocks__/jose.js neuters JWT (no purpose field) — override here so
// the challenge-token roundtrip behaves like production.
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader(this: unknown) { return this },
    setExpirationTime(this: unknown) { return this },
    sign: async () => 'test-mfa-challenge-token',
  })),
  jwtVerify: jest.fn(async () => ({ payload: { userId: 'u-rc', purpose: 'mfa' } })),
}))
const { jwtVerify } = jest.requireMock('jose') as { jwtVerify: jest.Mock }

import { POST as recoveryPOST } from '@/app/api/auth/mfa/recovery/route'
import { generateMFAToken } from '@/lib/mfa-token'
import { encryptRecoveryCodes, generateRecoveryCodes } from '@/lib/recovery-codes'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 200
function recReq(body: unknown) {
  ip += 1
  return new NextRequest('http://x/api/auth/mfa/recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.61.0.${ip}` },
    body: JSON.stringify(body),
  })
}

const CODES = generateRecoveryCodes()
const ENC = encryptRecoveryCodes(CODES)

function codedUser() {
  return {
    id: 'u-rc', username: 'rcuser', role: 'member', tokenVersion: 1,
    onboardingCompleted: true, recoveryCodes: ENC, recoveryCodesUsed: [],
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUpdate.mockResolvedValue({ id: 'u-rc' })
})

describe('POST /api/auth/mfa/recovery token binding', () => {
  it('rejects raw-userId recovery WITHOUT touching the DB (no oracle)', async () => {
    const res = await recoveryPOST(recReq({ userId: 'u-victim', code: CODES[0] }))
    expect(res.status).toBe(422)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('rejects forged challenge tokens', async () => {
    jwtVerify.mockRejectedValueOnce(new Error('invalid signature'))
    const res = await recoveryPOST(recReq({ mfaToken: 'forged.forged.forged', code: CODES[0] }))
    expect(res.status).toBe(422)
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('valid token + valid code → 200, marks used, audits', async () => {
    mockFindUnique.mockResolvedValue(codedUser())
    const token = await generateMFAToken('u-rc')
    const res = await recoveryPOST(recReq({ mfaToken: token, code: CODES[0] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(expect.objectContaining({ success: true, remainingCodes: 9 }))
    expect(mockSetRoleCookie).toHaveBeenCalled()
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa_recovery_used', userId: 'u-rc' }),
    )
  })

  it('valid token + wrong code → 422 + failure audit, no login', async () => {
    mockFindUnique.mockResolvedValue(codedUser())
    const token = await generateMFAToken('u-rc')
    const res = await recoveryPOST(recReq({ mfaToken: token, code: 'WRONG-CODE-1' }))
    expect(res.status).toBe(422)
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa_recovery_failed', userId: 'u-rc' }),
    )
  })

  it('valid token but no recovery codes on file → 422', async () => {
    mockFindUnique.mockResolvedValue({ ...codedUser(), recoveryCodes: null })
    const token = await generateMFAToken('u-rc')
    const res = await recoveryPOST(recReq({ mfaToken: token, code: CODES[0] }))
    expect(res.status).toBe(422)
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })
})
