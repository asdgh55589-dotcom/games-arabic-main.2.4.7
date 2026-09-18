/**
 * Fix 1 (Phase 4B): POST /api/auth/mfa/disable requires step-up proof.
 *
 * Abuse case: stolen session → disable victim's 2FA → persistent access.
 * - no proof → 422, nothing wiped, no audit
 * - wrong password → 422, nothing wiped
 * - correct password → 200 + wipe + audit(method=password)
 * - passwordless + valid TOTP → 200 + audit(method=totp)
 * - passwordless without TOTP → 422
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest-4b'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockGetSession = jest.fn()
const mockSetRoleCookie = jest.fn()
jest.mock('@/lib/auth', () => ({
  getSession: (...a: Array<never>) => mockGetSession(...a),
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
}))

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...a: Array<never>) => mockFindUnique(...a), update: (...a: Array<never>) => mockUpdate(...a) } },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
const { logAction } = jest.requireMock('@/lib/audit') as { logAction: jest.Mock }

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { signInWithPassword: jest.fn(async () => ({ error: null })) } })),
}))

import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import { POST as disablePOST } from '@/app/api/auth/mfa/disable/route'
import { encryptTOTPSecret } from '@/lib/totp'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 100
function disReq(body: unknown) {
  ip += 1
  return new NextRequest('http://x/api/auth/mfa/disable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.60.0.${ip}` },
    body: JSON.stringify(body),
  })
}

const SECRET = 'JBSWY3DPEHPK3PXP'
let pwHash = ''

beforeAll(async () => {
  pwHash = await bcrypt.hash('correct-password-1', 10)
})

function pwUser() {
  return {
    id: 'u-mfa', username: 'mfauser', email: 'm@m.io',
    totpEnabled: true, totpSecret: encryptTOTPSecret(SECRET),
    password: pwHash, supabaseId: 'sb-1',
  }
}

function passwordlessUser() {
  return {
    id: 'u-mfa2', username: 'mfauser2', email: 'telegram_9@telegram.local',
    totpEnabled: true, totpSecret: encryptTOTPSecret(SECRET),
    password: null, supabaseId: null,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetSession.mockResolvedValue({ id: 'u-mfa', username: 'mfauser' })
  mockUpdate.mockResolvedValue({ id: 'u-mfa', role: 'member', tokenVersion: 2, onboardingCompleted: true })
})

describe('POST /api/auth/mfa/disable step-up proof', () => {
  it('rejects unauthenticated callers', async () => {
    mockGetSession.mockResolvedValue(null)
    const res = await disablePOST(disReq({ password: 'x' }))
    expect(res.status).toBe(401)
  })

  it('rejects proof-less requests (422, nothing wiped, no audit)', async () => {
    mockFindUnique.mockResolvedValue(pwUser())
    const res = await disablePOST(disReq({}))
    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(logAction).not.toHaveBeenCalled()
  })

  it('rejects wrong password for password holders', async () => {
    mockFindUnique.mockResolvedValue(pwUser())
    const res = await disablePOST(disReq({ password: 'wrong-password-9' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(JSON.stringify(body)).toMatch('غير صحيحة')
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(logAction).not.toHaveBeenCalled()
  })

  it('accepts correct password → wipes MFA + audits method=password', async () => {
    mockFindUnique.mockResolvedValue(pwUser())
    const res = await disablePOST(disReq({ password: 'correct-password-1' }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-mfa' },
        data: expect.objectContaining({ totpEnabled: false, totpSecret: null }),
      }),
    )
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mfa_disabled', userId: 'u-mfa' }),
    )
    const details = (logAction.mock.calls[0][0] as { details: string }).details
    expect(details).toMatch('password')
  })

  it('passwordless users must present a TOTP code (missing → 422)', async () => {
    mockGetSession.mockResolvedValue({ id: 'u-mfa2', username: 'mfauser2' })
    mockFindUnique.mockResolvedValue(passwordlessUser())
    const res = await disablePOST(disReq({}))
    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('passwordless users with a valid TOTP code → 200 + audit(method=totp)', async () => {
    mockGetSession.mockResolvedValue({ id: 'u-mfa2', username: 'mfauser2' })
    mockFindUnique.mockResolvedValue(passwordlessUser())
    mockUpdate.mockResolvedValue({ id: 'u-mfa2', role: 'member', tokenVersion: 1, onboardingCompleted: true })
    const code = authenticator.generate(SECRET)
    const res = await disablePOST(disReq({ totpCode: code }))
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalled()
    const details = (logAction.mock.calls[0][0] as { details: string }).details
    expect(details).toMatch('totp')
  })

  it('passwordless users with a wrong TOTP code → 422', async () => {
    mockGetSession.mockResolvedValue({ id: 'u-mfa2', username: 'mfauser2' })
    mockFindUnique.mockResolvedValue(passwordlessUser())
    const res = await disablePOST(disReq({ totpCode: '000000' }))
    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('refuses when MFA is not enabled', async () => {
    mockFindUnique.mockResolvedValue({ ...pwUser(), totpEnabled: false })
    const res = await disablePOST(disReq({ password: 'correct-password-1' }))
    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
