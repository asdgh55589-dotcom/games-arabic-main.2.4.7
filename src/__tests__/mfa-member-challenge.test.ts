/**
 * Phase 4C: optional MFA for member login (identifier + Supabase paths).
 *
 * - identifier login, TOTP user → 200 {mfaRequired, mfaToken}, NO session
 *   (no role cookie, no ledger), challenge audited
 * - identifier login, no MFA → unchanged full session (optionality)
 * - POST /mfa/challenge: Supabase-authed TOTP user → token; no-MFA → 422;
 *   anonymous → 401
 * - GET /mfa/status: new fields (mfaEnabledAt, lastMfaLoginAt) present
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest-4c'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockCompare = jest.fn()
jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: (...a: Array<never>) => mockCompare(...a) },
  compare: (...a: Array<never>) => mockCompare(...a),
}))

const mockFindUnique = jest.fn()
const mockFindFirst = jest.fn()
const mockUpdate = jest.fn()
const mockAuditFirst = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: Array<never>) => mockFindUnique(...a),
      findFirst: (...a: Array<never>) => mockFindFirst(...a),
      update: (...a: Array<never>) => mockUpdate(...a),
    },
    auditLog: { findFirst: (...a: Array<never>) => mockAuditFirst(...a) },
  },
}))

const mockSetRoleCookie = jest.fn()
const mockGetSession = jest.fn()
jest.mock('@/lib/auth', () => ({
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
  getSession: (...a: Array<never>) => mockGetSession(...a),
  getBanStatus: jest.requireActual('@/lib/auth').getBanStatus,
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
const { logAction } = jest.requireMock('@/lib/audit') as { logAction: jest.Mock }

const mockCreateLedger = jest.fn()
jest.mock('@/lib/session-ledger', () => ({
  createSessionLedger: (...a: Array<never>) => mockCreateLedger(...a),
}))

jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }))

const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: mockSbGetUser } })),
}))

// jose is neutered globally — challenge tokens just need to be returned.
jest.mock('jose', () => ({
  SignJWT: jest.fn().mockImplementation(() => ({
    setProtectedHeader(this: unknown) { return this },
    setExpirationTime(this: unknown) { return this },
    sign: async () => 'test-mfa-challenge-token',
  })),
  jwtVerify: jest.fn(async () => ({ payload: { userId: 'u-7', purpose: 'mfa' } })),
}))

import { POST as identifierPOST } from '@/app/api/auth/login-identifier/route'
import { POST as challengePOST } from '@/app/api/auth/mfa/challenge/route'
import { GET as statusGET } from '@/app/api/auth/mfa/status/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 400
function post(path: string, body: unknown) {
  ip += 1
  return new NextRequest(`http://x${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.70.0.${ip}` },
    body: JSON.stringify(body),
  })
}

function totpUser() {
  return {
    id: 'u-7', username: 'tguser', email: 'real-tg@mail.com', password: 'hash',
    role: 'member', avatarUrl: null, tokenVersion: 3, onboardingCompleted: true,
    banStatus: 'active', bannedUntil: null, banReason: null,
    totpEnabled: true, totpSecret: 'enc-secret', recoveryCodesUsed: [0, 1],
  }
}

function plainUser() {
  return { ...totpUser(), totpEnabled: false, totpSecret: null, recoveryCodesUsed: [] }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCompare.mockResolvedValue(true)
  mockSbGetUser.mockResolvedValue({ data: { user: null } })
  mockGetSession.mockResolvedValue(null)
  mockCreateLedger.mockResolvedValue({ token: 'led', expiresAt: new Date() })
  mockUpdate.mockResolvedValue({})
})

describe('identifier login MFA challenge', () => {
  it('TOTP user → mfaRequired + token, NO session cookies/ledger', async () => {
    mockFindUnique.mockResolvedValue(totpUser())
    const res = await identifierPOST(post('/api/auth/login-identifier', { identifier: 'tguser', password: 'pw-12345678' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(
      expect.objectContaining({ mfaRequired: true, mfaToken: 'test-mfa-challenge-token', recoveryCodesCount: 8 }),
    )
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
    expect(mockCreateLedger).not.toHaveBeenCalled()
    expect(logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'mfa_challenge_issued' }))
  })

  it('non-MFA user → unchanged full session (optionality)', async () => {
    mockFindUnique.mockResolvedValue(plainUser())
    const res = await identifierPOST(post('/api/auth/login-identifier', { identifier: 'tguser', password: 'pw-12345678' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.mfaRequired).toBeUndefined()
    expect(mockSetRoleCookie).toHaveBeenCalled()
    expect(mockCreateLedger).toHaveBeenCalled()
  })
})

describe('POST /api/auth/mfa/challenge (Supabase path)', () => {
  it('Supabase-authed TOTP user → challenge token', async () => {
    mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-7', email: 'real-tg@mail.com' } } })
    mockFindFirst.mockResolvedValue({ id: 'u-7' })
    mockFindUnique.mockResolvedValue(totpUser())
    const res = await challengePOST(post('/api/auth/mfa/challenge', {}))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(expect.objectContaining({ mfaRequired: true, mfaToken: 'test-mfa-challenge-token' }))
  })

  it('Supabase-authed user without MFA → 422 (client proceeds normally)', async () => {
    mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-7', email: 'real-tg@mail.com' } } })
    mockFindFirst.mockResolvedValue({ id: 'u-7' })
    mockFindUnique.mockResolvedValue(plainUser())
    const res = await challengePOST(post('/api/auth/mfa/challenge', {}))
    expect(res.status).toBe(422)
  })

  it('anonymous → 401', async () => {
    mockSbGetUser.mockResolvedValue({ data: { user: null } })
    const res = await challengePOST(post('/api/auth/mfa/challenge', {}))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/mfa/status new fields', () => {
  it('returns mfaEnabledAt + lastMfaLoginAt alongside existing fields', async () => {
    mockGetSession.mockResolvedValue({ id: 'u-7' })
    mockFindUnique.mockResolvedValue({
      totpEnabled: true,
      mfaEnabledAt: new Date('2026-01-05T00:00:00Z'),
      webauthnCredentials: [],
      recoveryCodes: 'eA==',
      recoveryCodesUsed: [0],
    })
    mockAuditFirst.mockResolvedValue({ createdAt: new Date('2026-02-01T00:00:00Z') })
    const res = await statusGET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(
      expect.objectContaining({
        totpEnabled: true,
        recoveryCodesRemaining: 9,
        mfaEnabledAt: '2026-01-05T00:00:00.000Z',
        lastMfaLoginAt: '2026-02-01T00:00:00.000Z',
      }),
    )
  })
})
