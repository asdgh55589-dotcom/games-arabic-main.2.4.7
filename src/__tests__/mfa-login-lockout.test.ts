/**
 * Phase 1: POST /api/auth/mfa/login second-factor brute-force hardening.
 *
 * The route verified a 6-digit TOTP code with no attempt accounting: a caller
 * holding a stolen 10-minute MFA challenge token could burn ~1e6 codes without
 * ever tripping a limiter. Now every wrong code increments a SHARED (Redis)
 * per-account counter, the account is locked at MFA_MAX_ATTEMPTS inside the
 * token window, and a success clears the counter.
 *
 * Also pins lib/mfa-defense key hygiene (hashed keys, TTL window = token TTL,
 * fail-open on store errors).
 */

process.env.JWT_SECRET = 'test-secret-key-for-jest-mfa-login'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

const mockSetRoleCookie = jest.fn()
jest.mock('@/lib/auth', () => ({
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
}))

const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: Array<never>) => mockFindUnique(...a),
      update: (...a: Array<never>) => mockUpdate(...a),
    },
  },
}))

jest.mock('@/lib/totp', () => ({
  decryptTOTPSecret: jest.fn().mockReturnValue('TOTPSECRET'),
  verifyTOTP: jest.fn(),
}))

jest.mock('@/lib/mfa-token', () => ({
  verifyMFAToken: jest.fn(async (token: string) =>
    token === 'good-token' ? { userId: 'u-1' } : null,
  ),
}))

const mockRedisGet = jest.fn()
const mockRedisIncr = jest.fn()
const mockRedisDel = jest.fn()
jest.mock('@/lib/redis', () => ({
  redisGet: (...a: Array<never>) => mockRedisGet(...a),
  redisIncr: (...a: Array<never>) => mockRedisIncr(...a),
  redisDel: (...a: Array<never>) => mockRedisDel(...a),
}))

import { POST as mfaLoginPOST } from '@/app/api/auth/mfa/login/route'
import { getMfaAttempts, isMfaLocked, MFA_MAX_ATTEMPTS } from '@/lib/mfa-defense'
import { verifyTOTP } from '@/lib/totp'

const mockVerifyTOTP = verifyTOTP as jest.MockedFunction<typeof verifyTOTP>
const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

/** In-memory stand-in for the shared Redis counter store. */
const store = new Map<string, number>()

function mfaReq(body: unknown) {
  return new NextRequest('http://x/api/auth/mfa/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
    body: JSON.stringify(body),
  })
}

function mfaUser() {
  return {
    id: 'u-1',
    role: 'member',
    totpSecret: 'enc',
    tokenVersion: 3,
    totpEnabled: true,
    onboardingCompleted: true,
    username: 'tester',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFindUnique.mockResolvedValue(mfaUser())
  mockUpdate.mockResolvedValue({})
  // Coherent fake shared store so get/incr/del behave like Redis.
  store.clear()
  mockRedisGet.mockImplementation(async (key: unknown) => store.get(key as string) ?? null)
  mockRedisIncr.mockImplementation(async (key: unknown) => {
    const k = key as string
    const n = (store.get(k) ?? 0) + 1
    store.set(k, n)
    return n
  })
  mockRedisDel.mockImplementation(async (key: unknown) => {
    store.delete(key as string)
  })
})

describe('lib/mfa-defense', () => {
  it('keys the counter by a sha256 hash — never the raw user id', async () => {
    await getMfaAttempts('user-42')

    const key = mockRedisGet.mock.calls[0][0] as unknown as string
    expect(key).toMatch(/^auth:mfa-fail:[0-9a-f]{64}$/)
    expect(key).not.toContain('user-42')
  })

  it('uses the MFA token lifetime as the counter TTL', async () => {
    await getMfaAttempts('user-42').catch(() => undefined)
    const { recordMfaFailure } = await import('@/lib/mfa-defense')

    await recordMfaFailure('user-42')

    expect(mockRedisIncr).toHaveBeenCalledWith(expect.stringMatching(/^auth:mfa-fail:/), 10 * 60)
  })

  it('fails OPEN when the store throws (degraded Redis must not lock everyone out)', async () => {
    mockRedisGet.mockRejectedValue(new Error('redis down'))
    mockRedisIncr.mockRejectedValue(new Error('redis down'))
    mockRedisDel.mockRejectedValue(new Error('redis down'))
    const { recordMfaFailure, clearMfaFailures } = await import('@/lib/mfa-defense')

    await expect(getMfaAttempts('user-42')).resolves.toBe(0)
    await expect(isMfaLocked('user-42')).resolves.toBe(false)
    await expect(recordMfaFailure('user-42')).resolves.toBe(0)
    await expect(clearMfaFailures('user-42')).resolves.toBeUndefined()
  })

  it('treats MFA_MAX_ATTEMPTS failures as locked', async () => {
    mockRedisGet.mockResolvedValue(MFA_MAX_ATTEMPTS)
    await expect(isMfaLocked('user-42')).resolves.toBe(true)
  })
})

describe('POST /api/auth/mfa/login', () => {
  it('422s an incomplete body before any verification work', async () => {
    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token' }))

    expect(res.status).toBe(422)
    expect(mockVerifyTOTP).not.toHaveBeenCalled()
  })

  it('rejects a forged/expired challenge token', async () => {
    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'forged', code: '123456' }))

    expect(res.status).toBe(422)
    expect(mockVerifyTOTP).not.toHaveBeenCalled()
  })

  it('records a failure and reports remaining attempts on a wrong code', async () => {
    mockVerifyTOTP.mockReturnValue(false)

    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token', code: '000000' }))

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.details.remainingAttempts).toBe(MFA_MAX_ATTEMPTS - 1)
    expect(mockRedisIncr).toHaveBeenCalledWith(expect.stringMatching(/^auth:mfa-fail:/), 10 * 60)
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })

  it('locks the account with 429 once the counter is exhausted (no TOTP check)', async () => {
    mockRedisGet.mockResolvedValue(MFA_MAX_ATTEMPTS)

    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token', code: '000000' }))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockVerifyTOTP).not.toHaveBeenCalled()
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })

  it('even a VALID code is refused while the account is locked', async () => {
    mockRedisGet.mockResolvedValue(MFA_MAX_ATTEMPTS)
    mockVerifyTOTP.mockReturnValue(true)

    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token', code: '123456' }))

    expect(res.status).toBe(429)
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })

  it('completes login and clears the counter on a valid code', async () => {
    mockVerifyTOTP.mockReturnValue(true)

    const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token', code: '123456' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ data: { success: true } })
    expect(mockSetRoleCookie).toHaveBeenCalledWith('u-1', 'member', 3, true, true)
    expect(mockRedisDel).toHaveBeenCalledWith(expect.stringMatching(/^auth:mfa-fail:/))
  })

  it('locks after 5 consecutive wrong codes and never sets the session cookie', async () => {
    mockVerifyTOTP.mockReturnValue(false)

    const statuses: number[] = []
    for (let i = 0; i < MFA_MAX_ATTEMPTS + 2; i++) {
      const res = await mfaLoginPOST(mfaReq({ mfaToken: 'good-token', code: '000000' }))
      statuses.push(res.status)
    }

    // The first MFA_MAX_ATTEMPTS are 422 (each counted), then 429 forever.
    expect(statuses.slice(0, MFA_MAX_ATTEMPTS)).toEqual(
      Array.from({ length: MFA_MAX_ATTEMPTS }, () => 422),
    )
    expect(statuses.slice(MFA_MAX_ATTEMPTS)).toEqual([429, 429])
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
  })
})
