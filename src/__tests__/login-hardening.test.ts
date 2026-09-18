/**
 * Audit D.2 login hardening: one generic Arabic error for every credential
 * failure (no enumeration), progressive delay per IP+username (0,1,2,4,8s
 * cap), rate-limited OAuth callback, Phase 4A hard lockout (10 fails in
 * 15 min → 15-min 429) replacing the removed CAPTCHA placeholder.
 */
import {
  ACCOUNT_LOCKED_MESSAGE,
  LOGIN_GENERIC_ERROR,
  activateLockout,
  getLockoutRemainingSeconds,
  loginDelayFor,
  recordLoginFailure,
  getLoginFailures,
  clearLoginFailures,
} from '@/lib/login-defense'

const mockDbUser = { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: Array<never>) => mockDbUser.findUnique(...a),
      findFirst: (...a: Array<never>) => mockDbUser.findFirst(...a),
      update: (...a: Array<never>) => mockDbUser.update(...a),
    },
  },
}))

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn().mockResolvedValue(false) },
}))

const mockStudio = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: (...a: Array<never>) => mockStudio(...a),
  getBanStatus: () => ({ banned: false }),
  setRoleCookie: jest.fn(),
  hashPassword: jest.fn(),
  createSupabaseAuthUser: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(() => null),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }))
jest.mock('@/lib/security-key', () => ({
  hashSecurityKey: jest.fn(),
  verifySecurityKey: jest.fn().mockResolvedValue(false),
  isSecurityKeyExpired: jest.fn().mockReturnValue(false),
}))

import { POST as loginPOST } from '@/app/api/auth/login/route'
import { GET as callbackGET } from '@/app/api/auth/callback/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function loginReq(body: unknown, ip = '9.9.9.9') {
  return new NextRequest('http://x/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

const GOOD_SHAPE = { username: 'boss', email: 'boss@x.io', password: 'x'.repeat(12), securityKey: 'k' }

describe('generic error (no enumeration)', () => {
  beforeEach(() => {
    process.env.OWNER_USERNAME = 'boss-owner'
    process.env.OWNER_EMAIL = 'owner@x.io'
    process.env.OWNER_PASSWORD = 'owner-pass-12345'
    mockDbUser.findFirst.mockResolvedValue({ username: 'boss-owner', email: 'owner@x.io', securityKey: 'x' })
  })

  it('unknown user, email mismatch, bad password, bad key → identical 401', async () => {
    const results: Array<{ status: number; error?: string }> = []
    // 1. unknown user
    mockDbUser.findUnique.mockResolvedValue(null)
    results.push(await unpack(await loginPOST(loginReq(GOOD_SHAPE, '9.9.9.1'))))
    // 2. email mismatch
    mockDbUser.findUnique.mockResolvedValue({ ...baseUser(), email: 'other@x.io' })
    results.push(await unpack(await loginPOST(loginReq(GOOD_SHAPE, '9.9.9.2'))))
    // 3. bad password (bcrypt mocked false)
    mockDbUser.findUnique.mockResolvedValue(baseUser())
    results.push(await unpack(await loginPOST(loginReq(GOOD_SHAPE, '9.9.9.3'))))
    // 4. bad security key (verify mocked false)
    mockDbUser.findUnique.mockResolvedValue(baseUser())
    results.push(await unpack(await loginPOST(loginReq({ ...GOOD_SHAPE, securityKey: 'wrong' }, '9.9.9.4'))))
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401])
    expect(new Set(results.map((r) => r.error)).size).toBe(1)
    expect(results[0].error).toBe(LOGIN_GENERIC_ERROR)
  })
})

async function unpack(res: Response): Promise<{ status: number; error?: string }> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return { status: res.status, error: body.error }
}

function baseUser() {
  return {
    id: 'u-9', username: 'boss', email: 'boss@x.io', password: 'hashed',
    securityKey: 'sk', securityKeyExpiresAt: null, role: 'admin',
    tokenVersion: 1, onboardingCompleted: true, avatarUrl: null,
    banStatus: 'active', bannedUntil: null, banReason: null,
    supabaseId: null, lastLoginAt: null, loginCount: 0,
  }
}

describe('progressive delay', () => {
  it('0,1,2,4,8s cap progression', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(loginDelayFor)).toEqual([0, 1, 2, 4, 8, 8, 8])
  })

  it('record/get/clear roundtrip per key', async () => {
    const k = 'test-key-' + Date.now()
    expect(await getLoginFailures(k)).toBe(0)
    await recordLoginFailure(k)
    await recordLoginFailure(k)
    expect(await getLoginFailures(k)).toBe(2)
    await clearLoginFailures(k)
    expect(await getLoginFailures(k)).toBe(0)
  })
})

describe('hard lockout (Phase 4A — replaces CAPTCHA placeholder)', () => {
  it('10 failures activate the lock; 9 do not', async () => {
    const k = 'lock-route-' + Date.now()
    for (let i = 0; i < 9; i++) await recordLoginFailure(k)
    expect(await getLockoutRemainingSeconds(k)).toBe(0)
    await recordLoginFailure(k)
    expect(await getLockoutRemainingSeconds(k)).toBeGreaterThan(0)
    await clearLoginFailures(k)
  })

  it('activateLockout → remaining > 0 → clearLoginFailures unlocks', async () => {
    const k = 'lock-unit-' + Date.now()
    expect(await getLockoutRemainingSeconds(k)).toBe(0)
    await activateLockout(k)
    const remaining = await getLockoutRemainingSeconds(k)
    expect(remaining).toBeGreaterThan(14 * 60)
    expect(remaining).toBeLessThanOrEqual(15 * 60)
    expect(ACCOUNT_LOCKED_MESSAGE).toMatch('تم قفل الحساب مؤقتًا')
    await clearLoginFailures(k)
    expect(await getLockoutRemainingSeconds(k)).toBe(0)
  })

  it('route serves 429 with Arabic message once the composite key is locked', async () => {
    process.env.OWNER_USERNAME = 'boss-owner'
    process.env.OWNER_EMAIL = 'owner@x.io'
    process.env.OWNER_PASSWORD = 'owner-pass-12345'
    mockDbUser.findFirst.mockResolvedValue({ username: 'boss-owner', email: 'owner@x.io', securityKey: 'x' })
    const ip = '9.9.7.8'
    // 10 recorded failures on THIS composite key (real shared store)…
    const { failureKey } = await import('@/lib/login-defense')
    const fkey = failureKey(ip, 'boss')
    for (let i = 0; i < 10; i++) await recordLoginFailure(fkey)
    mockDbUser.findUnique.mockResolvedValue(baseUser())
    const res = await loginPOST(loginReq(GOOD_SHAPE, ip))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_LOCKED')
    expect(body.error.message).toMatch('تم قفل الحساب مؤقتًا')
    expect(res.headers.get('Retry-After')).toMatch(/^\d+$/)
    // …then a successful login clears it (unit-level unlock proof)
    await clearLoginFailures(fkey)
    expect(await getLockoutRemainingSeconds(fkey)).toBe(0)
  })
})

describe('callback rate limit', () => {
  it('hammering GET /api/auth/callback trips 429', async () => {
    let limited = 0
    for (let i = 0; i < 30; i++) {
      const res = await callbackGET(
        new NextRequest('http://x/api/auth/callback?code=nope', {
          method: 'GET',
          headers: { 'x-forwarded-for': '8.8.8.8' },
        }),
      )
      if (res.status === 429) limited++
    }
    expect(limited).toBeGreaterThan(0)
  }, 30000)
})
