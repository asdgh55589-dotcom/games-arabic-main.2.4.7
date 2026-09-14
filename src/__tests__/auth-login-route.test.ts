process.env.JWT_SECRET = 'test-secret-key-for-jest'
process.env.OWNER_USERNAME = 'owner-user'
process.env.OWNER_EMAIL = 'owner@test.com'
process.env.OWNER_PASSWORD = 'owner-pass-12345'

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
  headers: jest.fn(),
}))

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: jest.fn(), hash: jest.fn().mockResolvedValue('hashed-pw') },
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/token-version-cache', () => ({
  setTokenVersionCache: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(),
  rateLimitHeaders: jest.fn(),
}))

jest.mock('@/lib/ratelimit', () => ({
  checkRateLimit: jest.fn(),
}))

jest.mock('@/lib/login-defense', () => ({
  LOGIN_GENERIC_ERROR: 'بيانات الدخول غير صحيحة',
  captchaRequired: jest.fn().mockReturnValue(false),
  clearLoginFailures: jest.fn(),
  failureKey: jest.fn().mockReturnValue('test-fkey'),
  getLoginFailures: jest.fn().mockReturnValue(0),
  loginDelayFor: jest.fn().mockReturnValue(0),
  recordLoginFailure: jest.fn(),
  sleep: jest.fn().mockResolvedValue(undefined),
  verifyCaptchaToken: jest.fn().mockResolvedValue({ ok: true, placeholder: true }),
}))

jest.mock('@/lib/security-key', () => ({
  hashSecurityKey: jest.fn().mockResolvedValue('hashed-key'),
  verifySecurityKey: jest.fn(),
  isSecurityKeyExpired: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/error-reporting', () => ({
  reportError: jest.fn(),
}))

const mockFindUnique = jest.fn()
const mockFindFirst = jest.fn()
const mockUpdate = jest.fn()
const mockCreate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: Array<any>) => mockFindUnique(...a),
      findFirst: (...a: Array<any>) => mockFindFirst(...a),
      update: (...a: Array<any>) => mockUpdate(...a),
      create: (...a: Array<any>) => mockCreate(...a),
    },
  },
}))

const mockCreateSupabaseAuthUser = jest.fn()
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth')
  return {
    ...actual,
    createSupabaseAuthUser: (...a: Array<any>) => mockCreateSupabaseAuthUser(...a),
    setRoleCookie: jest.fn().mockResolvedValue(undefined),
    hashPassword: jest.fn().mockResolvedValue('hashed-pw'),
  }
})

import { POST } from '@/app/api/auth/login/route'
import bcrypt from 'bcryptjs'
import { createClient } from '@/lib/supabase/server'
import { verifySecurityKey, isSecurityKeyExpired } from '@/lib/security-key'
import { rateLimit as rateLimitFn } from '@/lib/rate-limit'
import { checkRateLimit } from '@/lib/ratelimit'
import { NextRequest } from 'next/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockBcryptCompare = bcrypt.compare as unknown as jest.Mock
const mockVerifySecurityKey = verifySecurityKey as jest.MockedFunction<typeof verifySecurityKey>
const mockIsSecurityKeyExpired = isSecurityKeyExpired as jest.MockedFunction<typeof isSecurityKeyExpired>
const mockRateLimit = rateLimitFn as jest.MockedFunction<typeof rateLimitFn>
const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>

function loginReq(body: unknown, ip = '1.2.3.4') {
  return new NextRequest('http://x/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function baseUser() {
  return {
    id: 'u-1',
    username: 'owner-user',
    email: 'owner@test.com',
    password: 'hashed-pw',
    securityKey: 'hashed-key',
    securityKeyExpiresAt: null,
    role: 'owner',
    tokenVersion: 0,
    onboardingCompleted: true,
    avatarUrl: null,
    banStatus: 'active',
    bannedUntil: null,
    banReason: null,
    supabaseId: null,
    lastLoginAt: null,
    loginCount: 0,
  }
}

function mockSupabaseLogin(success = true) {
  if (success) {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'supa-1' }, session: {} },
          error: null,
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'supa-1' } } }),
      },
    } as any)
  } else {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid login' },
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)
  }
}

function setupSuccessMocks(overrides: Partial<ReturnType<typeof baseUser>> = {}) {
  const user = { ...baseUser(), ...overrides }
  mockBcryptCompare.mockResolvedValue(true as any)
  mockVerifySecurityKey.mockResolvedValue(true)
  mockIsSecurityKeyExpired.mockReturnValue(false)
  mockSupabaseLogin(true)
  mockFindUnique.mockResolvedValue(user)
  mockUpdate.mockResolvedValue({})
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-setup rate limit mocks after clearAllMocks
    mockRateLimit.mockResolvedValue({ success: true, remaining: 4, resetAt: Date.now() + 60000, limit: 5 })
    mockCheckRateLimit.mockResolvedValue(true)
    // Setup ownerEnsured cache
    mockFindFirst.mockImplementation(async (args: any) => {
      if (args?.where?.role === 'owner') return baseUser()
      return null
    })
    mockFindUnique.mockResolvedValue(baseUser())
    mockUpdate.mockResolvedValue({})
    mockCreateSupabaseAuthUser.mockResolvedValue(null)
  })

  it('يرفض body غير صالح (missing fields)', async () => {
    const res = await POST(loginReq({}))
    expect(res.status).toBe(422)
  })

  it('يرفض username فارغ', async () => {
    const res = await POST(loginReq({ username: '', email: 'a@b.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(422)
  })

  it('يرفض email غير صالح', async () => {
    const res = await POST(loginReq({ username: 'u', email: 'not-an-email', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(422)
  })

  it('يرجع 401 لمستخدم غير موجود', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await POST(loginReq({ username: 'unknown', email: 'x@x.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(401)
    expect(body.error).toBe('بيانات الدخول غير صحيحة')
  })

  it('يرجع 401 عند عدم تطابق البريد الإلكتروني', async () => {
    mockFindUnique.mockResolvedValue({ ...baseUser(), email: 'other@test.com' })
    const res = await POST(loginReq({ username: 'owner-user', email: 'wrong@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 401 عند كلمة مرور خاطئة', async () => {
    mockBcryptCompare.mockResolvedValue(false as any)
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'wrong', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 401 عند مفتاح أمان خاطئ', async () => {
    mockBcryptCompare.mockResolvedValueOnce(true as any)
    mockVerifySecurityKey.mockResolvedValue(false)
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'wrong-key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 401 عندما لا يوجد securityKey للمستخدم', async () => {
    mockFindUnique.mockResolvedValue({ ...baseUser(), securityKey: null })
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 403 عندما يكون المستخدم محظوراً', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)
    mockFindUnique.mockResolvedValue({ ...baseUser(), banStatus: 'banned_perm' })
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(403)
  })

  it('يرجع 403 عندما يكون الدور member', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)
    mockFindUnique.mockResolvedValue({ ...baseUser(), role: 'member' })
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(403)
  })

  it('ينجح تسجيل الدخول مع حساب موجود في Supabase', async () => {
    setupSuccessMocks()
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.user.username).toBe('owner-user')
    expect(body.data.user.role).toBe('owner')
  })

  it('ينجح مع إنشاء حساب Supabase جديد عند فشل تسجيل الدخول', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    let callCount = 0
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockImplementation(async () => {
          callCount++
          if (callCount === 1) {
            return { data: { user: null }, error: { message: 'Invalid' } }
          }
          return { data: { user: { id: 'supa-new' }, session: {} }, error: null }
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    mockCreateSupabaseAuthUser.mockResolvedValue('new-supabase-id')

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.user.username).toBe('owner-user')
  })

  it('يرجع 401 عندما يفشل إنشاء حساب Supabase', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid' },
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    mockCreateSupabaseAuthUser.mockResolvedValue(null)

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 429 عند تجاوز حد المعدل', async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 60000, limit: 5 })
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(429)
  })

  it('يرجع 429 عند فشل checkRateLimit', async () => {
    mockCheckRateLimit.mockResolvedValue(false)
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(429)
  })

  it('يرجع خطأ عام 500 عند استثناء غير متوقع', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB exploded'))
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(500)
  })

  it('يربط supabaseId في DB عندما لا يكون موجوداً', async () => {
    mockFindUnique.mockResolvedValue({ ...baseUser(), supabaseId: null })
    setupSuccessMocks({ supabaseId: null })
    await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('يتعامل مع مفتاح أمان منتهي الصلاحية', async () => {
    mockIsSecurityKeyExpired.mockReturnValue(true)
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يرجع 401 عند فشل إعادة محاولة تسجيل الدخول بعد إنشاء الحساب', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    let callCount = 0
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockImplementation(async () => {
          callCount++
          if (callCount <= 2) {
            return { data: { user: null }, error: { message: 'Invalid' } }
          }
          return { data: { user: { id: 'supa-new' }, session: {} }, error: null }
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    mockCreateSupabaseAuthUser.mockResolvedValue('new-supabase-id')

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يتحقق من MFA عندما يكون TOTP مفعلاً', async () => {
    setupSuccessMocks()

    // Mock fresh user query for MFA check - second call returns MFA-enabled user
    mockFindUnique
      .mockResolvedValueOnce(baseUser()) // first call: login lookup
      .mockResolvedValueOnce({ totpEnabled: true, totpSecret: 'secret', recoveryCodesUsed: null }) // MFA check

    jest.mock('@/lib/mfa-token', () => ({
      generateMFAToken: jest.fn().mockResolvedValue('mfa-token-123'),
    }))

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.mfaRequired).toBe(true)
    expect(body.data.mfaToken).toBe('mfa-token-123')
    expect(body.data.recoveryCodesCount).toBe(10)
  })

  it('يرجع MFA مع recovery codes محسوبة', async () => {
    setupSuccessMocks()

    mockFindUnique
      .mockResolvedValueOnce(baseUser())
      .mockResolvedValueOnce({ totpEnabled: true, totpSecret: 'secret', recoveryCodesUsed: ['code1', 'code2', 'code3'] })

    jest.mock('@/lib/mfa-token', () => ({
      generateMFAToken: jest.fn().mockResolvedValue('mfa-token-456'),
    }))

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.recoveryCodesCount).toBe(7) // 10 - 3
  })

  it('يربط supabaseId من session عندما لا يكون موجوداً في Neon DB', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    // User without supabaseId
    mockFindUnique.mockResolvedValue({ ...baseUser(), supabaseId: null })

    // Supabase login succeeds and returns a user with an ID
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: 'supa-session-user' }, session: {} },
          error: null,
        }),
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'supa-session-user' } } }),
      },
    } as any)

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    // Should have called update to link supabaseId
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ supabaseId: 'supa-session-user' }),
      })
    )
  })

  it('يرجع 401 عندما يكون securityKey = null بعد نجاح كلمة المرور', async () => {
    // Password passes but securityKey is null → line 217
    mockBcryptCompare.mockResolvedValue(true as any)
    mockFindUnique.mockResolvedValue({ ...baseUser(), securityKey: null })
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
  })

  it('يطلب captcha عندما يكون مطلوباً', async () => {
    const { captchaRequired, getLoginFailures, verifyCaptchaToken } = require('@/lib/login-defense')
    captchaRequired.mockReturnValue(true)
    getLoginFailures.mockReturnValue(5)
    verifyCaptchaToken.mockResolvedValue({ ok: false, placeholder: false })

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
    expect(verifyCaptchaToken).toHaveBeenCalled()
  })

  it('يتجاوز captcha عندما يكون verdict.ok = true', async () => {
    const { captchaRequired, getLoginFailures, verifyCaptchaToken } = require('@/lib/login-defense')
    captchaRequired.mockReturnValue(true)
    getLoginFailures.mockReturnValue(5)
    verifyCaptchaToken.mockResolvedValue({ ok: true, placeholder: false })

    // After captcha passes, the login should proceed normally
    // But user won't exist → 401
    mockFindUnique.mockResolvedValue(null)
    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(401)
    expect(verifyCaptchaToken).toHaveBeenCalled()
  })

  it('يتعامل مع Temp ban ( banned_temp مع تاريخ منتهي)', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    // banned_temp with expired date → not actually banned
    mockFindUnique.mockResolvedValue({
      ...baseUser(),
      banStatus: 'banned_temp',
      bannedUntil: new Date('2020-01-01'),
    })

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    const body = await res.json()
    // Not banned (expired), but member role check... wait, role is 'owner' so it should succeed
    expect(res.status).toBe(200)
  })

  it('يرجع 403 مع رسالة حظر مؤقت when banned_temp with future date', async () => {
    mockBcryptCompare.mockResolvedValue(true as any)
    mockVerifySecurityKey.mockResolvedValue(true)
    mockIsSecurityKeyExpired.mockReturnValue(false)

    const futureDate = new Date('2099-01-01')
    mockFindUnique.mockResolvedValue({
      ...baseUser(),
      banStatus: 'banned_temp',
      bannedUntil: futureDate,
      banReason: 'انتهاك القواعد',
    })

    const res = await POST(loginReq({ username: 'owner-user', email: 'owner@test.com', password: 'pass', securityKey: 'key' }))
    expect(res.status).toBe(403)
  })
})
