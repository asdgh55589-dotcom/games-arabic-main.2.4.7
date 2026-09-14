process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
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
}))

jest.mock('@/lib/username-generator', () => ({
  generateUniqueUsername: jest.fn().mockResolvedValue('generated-user'),
  generateUsernameFromEmail: jest.fn().mockResolvedValue('email-user'),
}))

const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockCreate = jest.fn()
const mockTransaction = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: (...a: Array<never>) => mockFindFirst(...a),
      findUnique: (...a: Array<never>) => mockFindUnique(...a),
      update: (...a: Array<never>) => mockUpdate(...a),
      create: (...a: Array<never>) => mockCreate(...a),
    },
    oAuthAccount: {
      findUnique: (...a: Array<never>) => mockFindUnique(...a),
      create: (...a: Array<never>) => mockCreate(...a),
    },
    $transaction: (...a: Array<never>) => mockTransaction(...a),
    session: {
      create: (...a: Array<never>) => mockCreate(...a),
    },
    notificationPreference: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}))

import { GET } from '@/app/api/auth/callback/route'
import { createClient } from '@/lib/supabase/server'
import { rateLimit as rateLimitFn } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockRateLimit = rateLimitFn as jest.MockedFunction<typeof rateLimitFn>

function callbackReq(params: Record<string, string> = {}, ip = '1.2.3.4') {
  const qs = new URLSearchParams(params).toString()
  const url = `http://x/api/auth/callback${qs ? '?' + qs : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, host: 'x' },
  })
}

const SUPABASE_USER = {
  id: 'supa-user-1',
  email: 'user@example.com',
  app_metadata: { provider: 'google' },
  user_metadata: {
    avatar_url: 'https://avatar.url/img.png',
    full_name: 'Test User',
    username: 'testuser',
  },
}

const NEON_USER = {
  id: 'neon-1',
  username: 'testuser',
  email: 'user@example.com',
  role: 'member',
  avatarUrl: 'https://avatar.url/img.png',
  banStatus: 'active',
  bannedUntil: null,
  banReason: null,
  tokenVersion: 0,
  onboardingCompleted: false,
}

function mockSupabaseSession(user: typeof SUPABASE_USER | null, exchangeError: any = null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: exchangeError }),
      getUser: jest.fn().mockResolvedValue({ data: { user } }),
    },
  } as any)
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-setup rate limit mock after clearAllMocks
    mockRateLimit.mockResolvedValue({ success: true, remaining: 19, resetAt: Date.now() + 60000, limit: 20 })
    mockFindFirst.mockResolvedValue(null)
    mockFindUnique.mockResolvedValue(null)
    mockUpdate.mockResolvedValue({})
    mockCreate.mockResolvedValue({})
  })

  it('يرجع 429 عند تجاوز حد المعدل', async () => {
    const { rateLimit } = require('@/lib/rate-limit')
    rateLimit.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 60000, limit: 20 })

    const res = await GET(callbackReq({ code: 'test-code' }))
    expect(res.status).toBe(429)
  })

  it('يرجع redirect مع error=auth_failed عند فشل استبدال الكود', async () => {
    mockSupabaseSession(null, { message: 'Code expired' })
    const res = await GET(callbackReq({ code: 'expired-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=auth_failed')
  })

  it('يرجع redirect مع error=no_session عندما لا يوجد Supabase user', async () => {
    mockSupabaseSession(null)
    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=no_session')
  })

  it('يربط مستخدم موجود في Neon DB', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)
    mockUpdate.mockResolvedValue({})

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).not.toContain('error=')
  })

  it('يُنشئ مستخدم جديد + OAuthAccount عندما لا يوجد في DB', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(null) // user not found by supabaseId
    mockFindUnique.mockResolvedValue(null) // no OAuthAccount, no email conflict

    const newUser = { ...NEON_USER, id: 'new-user-1' }
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(newUser) },
        oAuthAccount: { create: jest.fn().mockResolvedValue({}) },
        notificationPreference: { create: jest.fn().mockResolvedValue({}).catch(() => {}) },
      }
      return fn(tx)
    })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('يرجع redirect مع error=email_exists_link_accounts عند تداخل البريد', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(null) // no user by supabaseId
    // Mock email conflict
    mockFindUnique.mockImplementation(async (args: any) => {
      if (args?.where?.email) return { id: 'existing-user' }
      return null
    })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=email_exists_link_accounts')
  })

  it('يرجع redirect مع error=banned للمستخدم المحظور', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue({ ...NEON_USER, banStatus: 'banned_perm' })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=banned')
  })

  it('يحترم معامل next للتحويل', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    const res = await GET(callbackReq({ code: 'valid-code', next: '/games' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('/games')
  })

  it('يحمي من Open Redirect (URL خارجي)', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    const res = await GET(callbackReq({ code: 'valid-code', next: '//evil.com' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).not.toContain('evil.com')
  })

  it('يحمي من path traversal في next', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    const res = await GET(callbackReq({ code: 'valid-code', next: '/../etc/passwd' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).not.toContain('etc')
  })

  it('يُنشئ session ledger cookie', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)
    mockCreate.mockResolvedValue({})

    const res = await GET(callbackReq({ code: 'valid-code' }))
    const cookies = res.headers.getSetCookie()
    expect(cookies.some(c => c.includes('ga_session_ledger'))).toBe(true)
  })

  it('يتعامل مع فشل إنشاء session ledger', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)
    mockCreate.mockRejectedValue(new Error('DB error'))

    const res = await GET(callbackReq({ code: 'valid-code' }))
    // Should still redirect successfully even if ledger fails
    expect(res.status).toBe(307)
  })

  it('يُحدّث avatarUrl عندما يكون فارغاً', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue({ ...NEON_USER, avatarUrl: null })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('لا يُحدّث avatarUrl عندما يكون موجوداً بالفعل', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue({ ...NEON_USER, avatarUrl: 'https://existing.jpg' })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
  })

  it('يبحث عبر OAuthAccount عندما لا يوجد في users', async () => {
    mockSupabaseSession(SUPABASE_USER)
    // First findFirst (by supabaseId) returns null
    mockFindFirst.mockResolvedValue(null)
    // findUnique for OAuthAccount returns existing link
    mockFindUnique.mockImplementation(async (args: any) => {
      if (args?.include?.user) {
        return { user: NEON_USER }
      }
      return null
    })

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
  })

  it('يستخدم generateUsernameFromEmail عندما لا يوجد username في metadata', async () => {
    const noUsernameUser = {
      ...SUPABASE_USER,
      user_metadata: { full_name: '', avatar_url: '' },
    }
    mockSupabaseSession(noUsernameUser)
    mockFindFirst.mockResolvedValue(null)
    mockFindUnique.mockResolvedValue(null)

    const { generateUsernameFromEmail } = require('@/lib/username-generator')
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(NEON_USER) },
        oAuthAccount: { create: jest.fn().mockResolvedValue({}) },
        notificationPreference: { create: jest.fn().mockResolvedValue({}).catch(() => {}) },
      }
      return fn(tx)
    })

    await GET(callbackReq({ code: 'valid-code' }))
    expect(generateUsernameFromEmail).toHaveBeenCalledWith('user@example.com')
  })

  it('يرجع redirect مع error=auth_failed عند استثناء', async () => {
    mockCreateClient.mockRejectedValue(new Error('Supabase down'))

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=auth_failed')
  })

  it('يعمل بدون code (.returnTo بدون OAuth)', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    const res = await GET(callbackReq({}))
    expect(res.status).toBe(307)
  })

  it('يُسجّل login audit بعد النجاح', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    await GET(callbackReq({ code: 'valid-code' }))

    const { logAction } = require('@/lib/audit')
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'login',
        entity: 'user',
        entityId: 'neon-1',
      })
    )
  })

  it('يُحدّث lastLoginAt و loginCount', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    await GET(callbackReq({ code: 'valid-code' }))

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'neon-1' },
        data: expect.objectContaining({
          lastLoginAt: expect.any(Date),
          loginCount: { increment: 1 },
        }),
      })
    )
  })

  it('يستخدم username من metadata عندما يكون متاحاً', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(null)
    mockFindUnique.mockResolvedValue(null)

    const { generateUniqueUsername } = require('@/lib/username-generator')
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        user: { create: jest.fn().mockResolvedValue(NEON_USER) },
        oAuthAccount: { create: jest.fn().mockResolvedValue({}) },
        notificationPreference: { create: jest.fn().mockResolvedValue({}).catch(() => {}) },
      }
      return fn(tx)
    })

    await GET(callbackReq({ code: 'valid-code' }))
    expect(generateUniqueUsername).toHaveBeenCalledWith('testuser')
  })

  it('يحمي من Open Redirect مع protocol-relative URL', async () => {
    mockSupabaseSession(SUPABASE_USER)
    mockFindFirst.mockResolvedValue(NEON_USER)

    const res = await GET(callbackReq({ code: 'valid-code', next: '//evil.com/path' }))
    const location = res.headers.get('location')!
    expect(location).not.toContain('evil.com')
  })

  it('يرجع redirect مع error=auth_failed عندما لا يوجد neonUser بعد كل الخطوات', async () => {
    mockSupabaseSession(SUPABASE_USER)
    // Everything returns null
    mockFindFirst.mockResolvedValue(null)
    mockFindUnique.mockResolvedValue(null)

    // Transaction creates user but returns null somehow
    mockTransaction.mockResolvedValue(null)

    const res = await GET(callbackReq({ code: 'valid-code' }))
    expect(res.status).toBe(307)
    const location = res.headers.get('location')!
    expect(location).toContain('error=auth_failed')
  })
})
