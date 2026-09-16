/**
 * Audit D.2 login hardening: one generic Arabic error for every credential
 * failure (no enumeration), progressive delay per IP+username (0,1,2,4,8s
 * cap), rate-limited OAuth callback, Turnstile hook placeholder after 5
 * fails.
 */
import {
  LOGIN_GENERIC_ERROR,
  captchaRequired,
  loginDelayFor,
  recordLoginFailure,
  getLoginFailures,
  clearLoginFailures,
  verifyCaptchaToken,
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

describe('captcha hook (Turnstile placeholder)', () => {
  it('required after 5 fails, not before', () => {
    expect(captchaRequired(4)).toBe(false)
    expect(captchaRequired(5)).toBe(true)
  })

  it('placeholder: unconfigured secret never blocks (explicit placeholder flag)', async () => {
    delete process.env.TURNSTILE_SECRET_KEY
    const out = await verifyCaptchaToken('any-token', '9.9.9.9')
    expect(out.placeholder).toBe(true)
    expect(out.ok).toBe(true)
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
