process.env.JWT_SECRET = 'test-secret-key-for-jest'

// Override the global jose mock with real JWT functionality
jest.mock('jose', () => {
  const crypto = require('crypto')
  return {
    SignJWT: class {
      private _payload: Record<string, unknown> = {}
      setProtectedHeader() { return this }
      setIssuedAt() { return this }
      setExpirationTime() { return this }
      sign(secret: Uint8Array) {
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
        const payload = Buffer.from(JSON.stringify(this._payload)).toString('base64url')
        const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
        return Promise.resolve(`${header}.${payload}.${sig}`)
      }
      constructor(payload: Record<string, unknown>) {
        this._payload = payload
      }
    },
    jwtVerify: async (token: string, secret: Uint8Array) => {
      const parts = token.split('.')
      if (parts.length !== 3) throw new Error('Invalid token')
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      const expectedSig = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url')
      if (parts[2] !== expectedSig) throw new Error('Invalid signature')
      return { payload }
    },
  }
})

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/token-version-cache', () => ({
  setTokenVersionCache: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/lib/roles', () => ({
  hasRoleAtLeast: jest.fn((role: string, min: string) => {
    const order = ['member', 'creator', 'publisher', 'moderator', 'admin', 'manager', 'owner']
    return order.indexOf(role) >= order.indexOf(min)
  }),
}))

const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: (...a: Array<never>) => mockFindFirst(...a),
      findUnique: (...a: Array<never>) => mockFindUnique(...a),
      update: (...a: Array<never>) => mockUpdate(...a),
    },
  },
}))

jest.mock('@/lib/api-key-auth', () => ({
  authenticateApiKey: jest.fn(),
}))

import { cookies, headers } from 'next/headers'
import {
  getSession,
  requireAuth,
  requireAdmin,
  requireOwner,
  requireModerator,
  requireCreator,
  requireCreatorStudio,
  requireManager,
  requireOnboarded,
  canEditMod,
  canDelete,
  getBanStatus,
  getClientIp,
  getUserIdFromRequestCookies,
  setRoleCookie,
  clearRoleCookie,
  hashPassword,
  getJWTSecret,
  invalidateUserSessions,
  getOptionalSession,
  getBanInfo,
  createSupabaseAuthUser,
  AuthError,
  type SessionUser,
} from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { authenticateApiKey } from '@/lib/api-key-auth'
import { setTokenVersionCache } from '@/lib/token-version-cache'
import { SignJWT, jwtVerify } from 'jose'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCookies = cookies as jest.MockedFunction<typeof cookies>
const mockHeaders = headers as jest.MockedFunction<typeof headers>
const mockAuthenticateApiKey = authenticateApiKey as jest.MockedFunction<typeof authenticateApiKey>
const mockSetTokenVersionCache = setTokenVersionCache as jest.MockedFunction<typeof setTokenVersionCache>

function mockSupabaseUser(user: { id: string; email?: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
  } as any)
}

function mockDbUser(user: any | null) {
  mockFindFirst.mockResolvedValue(user)
  mockFindUnique.mockResolvedValue(user)
}

function mockCookieStore(getValue: string | undefined) {
  mockCookies.mockResolvedValue({
    get: jest.fn().mockReturnValue(getValue ? { value: getValue } : undefined),
    set: jest.fn(),
    delete: jest.fn(),
  } as any)
}

function mockHeaderStore(authHeader: string | null) {
  mockHeaders.mockResolvedValue({
    get: jest.fn().mockImplementation((name: string) => {
      if (name === 'authorization') return authHeader
      return null
    }),
  } as any)
}

const TEST_USER: SessionUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'admin',
  avatarUrl: null,
  onboardingCompleted: true,
}

const DB_USER_ROW = {
  ...TEST_USER,
  banStatus: 'active',
  bannedUntil: null,
  banReason: null,
  tokenVersion: 0,
}

async function createRoleCookie(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!))
}

describe('getSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يُرجع null عندما لا يوجد أي مصادقة', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع المستخدم من Supabase Auth', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(DB_USER_ROW)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session!.id).toBe('user-1')
    expect(session!.role).toBe('admin')
  })

  it('يُرجع null عندما يكون المستخدم محظوراً (Supabase path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, banStatus: 'banned_perm' })
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما لا يوجد مستخدم في DB (Supabase path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(null)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يستخدم API Key Authentication عند وجود Authorization header', async () => {
    mockHeaderStore('Bearer test_api_key_12345678')
    mockAuthenticateApiKey.mockResolvedValue({
      valid: true,
      user: TEST_USER,
      apiKeyId: 'key-1',
    })
    const session = await getSession()
    expect(session).toEqual(TEST_USER)
    expect(mockAuthenticateApiKey).toHaveBeenCalledWith('Bearer test_api_key_12345678')
  })

  it('يتجاهل API Key Authentication عندما يرجع null', async () => {
    mockHeaderStore('Bearer test_api_key_invalid')
    mockAuthenticateApiKey.mockResolvedValue(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(DB_USER_ROW)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session!.id).toBe('user-1')
  })

  it('يتعامل مع فشل headers() بـ catch', async () => {
    mockHeaders.mockRejectedValue(new Error('headers() failed'))
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(DB_USER_ROW)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).not.toBeNull()
  })

  it('يتعامل مع فشل Supabase ويتبع role cookie', async () => {
    mockHeaderStore(null)
    mockCreateClient.mockRejectedValue(new Error('Supabase down'))
    const cookiePayload = { userId: 'user-1', role: 'admin', tv: 0 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    mockFindUnique.mockResolvedValue(DB_USER_ROW)
    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session!.id).toBe('user-1')
  })

  it('يُرجع null عندما tokenVersion لا يتطابق (Supabase path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, tokenVersion: 5 })
    const cookiePayload = { userId: 'user-1', role: 'admin', tv: 0 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما لا يوجد role cookie ولا Supabase session', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع المستخدم من role cookie فقط (بدون Supabase)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    const cookiePayload = { userId: 'user-1', role: 'admin', tv: 0 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    mockFindUnique.mockResolvedValue(DB_USER_ROW)
    const session = await getSession()
    expect(session).not.toBeNull()
    expect(session!.id).toBe('user-1')
  })

  it('يُرجع null عندما tokenVersion لا يتطابق (role cookie path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    const cookiePayload = { userId: 'user-1', role: 'admin', tv: 99 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    mockFindUnique.mockResolvedValue({ ...DB_USER_ROW, tokenVersion: 0 })
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما المستخدم محظور (role cookie path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    const cookiePayload = { userId: 'user-1', role: 'admin', tv: 0 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    mockFindUnique.mockResolvedValue({ ...DB_USER_ROW, banStatus: 'banned_perm' })
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما لا يوجد مستخدم في DB (role cookie path)', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    const cookiePayload = { userId: 'nonexistent', role: 'admin', tv: 0 }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    mockFindUnique.mockResolvedValue(null)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما لا يوجد userId أو role في الـ JWT', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    const cookiePayload = { userId: '', role: '' }
    const token = await createRoleCookie(cookiePayload)
    mockCookieStore(token)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عندما tokenVersion > 0 ولا يوجد cookie', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, tokenVersion: 3 })
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).toBeNull()
  })

  it('يسمح عندما tokenVersion = 0 ولا يوجد cookie', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, tokenVersion: 0 })
    mockCookieStore(undefined)
    const session = await getSession()
    expect(session).not.toBeNull()
  })
})

describe('requireAuth', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يُرجع المستخدم عندما يكون مسجلاً', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(DB_USER_ROW)
    mockCookieStore(undefined)
    const user = await requireAuth()
    expect(user.id).toBe('user-1')
  })

  it('يرمي AuthError 401 عندما لا يوجد جلسة', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    mockCookieStore(undefined)
    await expect(requireAuth()).rejects.toThrow(AuthError)
    try {
      await requireAuth()
    } catch (e) {
      expect((e as AuthError).status).toBe(401)
    }
  })
})

describe('requireAdmin', () => {
  beforeEach(() => jest.clearAllMocks())

  function mockAdminSession(role: string) {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role })
    mockCookieStore(undefined)
  }

  it('يسمح لـ owner', async () => {
    mockAdminSession('owner')
    const user = await requireAdmin()
    expect(user.role).toBe('owner')
  })

  it('يسمح لـ manager', async () => {
    mockAdminSession('manager')
    const user = await requireAdmin()
    expect(user.role).toBe('manager')
  })

  it('يسمح لـ admin', async () => {
    mockAdminSession('admin')
    const user = await requireAdmin()
    expect(user.role).toBe('admin')
  })

  it('يرفض moderator', async () => {
    mockAdminSession('moderator')
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })

  it('يرفض creator', async () => {
    mockAdminSession('creator')
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })

  it('يرفض member', async () => {
    mockAdminSession('member')
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })
})

describe('requireOwner', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يسمح لـ owner فقط', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'owner' })
    mockCookieStore(undefined)
    const user = await requireOwner()
    expect(user.role).toBe('owner')
  })

  it('يرفض admin', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'admin' })
    mockCookieStore(undefined)
    await expect(requireOwner()).rejects.toThrow(AuthError)
  })

  it('يرفض member', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member' })
    mockCookieStore(undefined)
    await expect(requireOwner()).rejects.toThrow(AuthError)
  })
})

describe('requireModerator', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يسمح لـ moderator', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'moderator' })
    mockCookieStore(undefined)
    const user = await requireModerator()
    expect(user.role).toBe('moderator')
  })

  it('يسمح لـ admin', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'admin' })
    mockCookieStore(undefined)
    const user = await requireModerator()
    expect(user.role).toBe('admin')
  })

  it('يرفض publisher', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'publisher' })
    mockCookieStore(undefined)
    await expect(requireModerator()).rejects.toThrow(AuthError)
  })

  it('يرفض member', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member' })
    mockCookieStore(undefined)
    await expect(requireModerator()).rejects.toThrow(AuthError)
  })
})

describe('requireCreator', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يسمح لـ creator', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'creator' })
    mockCookieStore(undefined)
    const user = await requireCreator()
    expect(user.role).toBe('creator')
  })

  it('يرفض member', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member' })
    mockCookieStore(undefined)
    await expect(requireCreator()).rejects.toThrow(AuthError)
  })
})

describe('requireManager', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يسمح لـ manager', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'manager' })
    mockCookieStore(undefined)
    const user = await requireManager()
    expect(user.role).toBe('manager')
  })

  it('يرفض admin', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'admin' })
    mockCookieStore(undefined)
    await expect(requireManager()).rejects.toThrow(AuthError)
  })
})

describe('requireOnboarded', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يسمح للمستخدم غير العضو المكمل للإعداد', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member', onboardingCompleted: true })
    mockCookieStore(undefined)
    const user = await requireOnboarded()
    expect(user.role).toBe('member')
  })

  it('يرفض العضو غير المكمل للإعداد', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member', onboardingCompleted: false })
    mockCookieStore(undefined)
    await expect(requireOnboarded()).rejects.toThrow(AuthError)
  })

  it('يسمح للadmin حتى لو لم يكمل الإعداد', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'admin', onboardingCompleted: false })
    mockCookieStore(undefined)
    const user = await requireOnboarded()
    expect(user.role).toBe('admin')
  })
})

describe('canEditMod', () => {
  const baseUser = { id: 'user-1', username: 'test', email: 't@t.com', role: 'creator' as const, avatarUrl: null, onboardingCompleted: true }

  it('admin يقدر يعدّل أي تعريب', () => {
    expect(canEditMod({ ...baseUser, role: 'admin' }, { authorId: 'other' })).toBe(true)
  })

  it('owner يقدر يعدّل أي تعريب', () => {
    expect(canEditMod({ ...baseUser, role: 'owner' }, { authorId: 'other' })).toBe(true)
  })

  it('moderator يقدر يعدّل تعريبه فقط', () => {
    expect(canEditMod({ ...baseUser, role: 'moderator' }, { authorId: 'user-1' })).toBe(true)
    expect(canEditMod({ ...baseUser, role: 'moderator' }, { authorId: 'other' })).toBe(false)
  })

  it('creator يقدر يعدّل تعريبه فقط', () => {
    expect(canEditMod({ ...baseUser, role: 'creator' }, { authorId: 'user-1' })).toBe(true)
    expect(canEditMod({ ...baseUser, role: 'creator' }, { authorId: 'other' })).toBe(false)
  })

  it('publisher يقدر يعدّل تعريبه فقط', () => {
    expect(canEditMod({ ...baseUser, role: 'publisher' }, { authorId: 'user-1' })).toBe(true)
    expect(canEditMod({ ...baseUser, role: 'publisher' }, { authorId: 'other' })).toBe(false)
  })

  it('member لا يقدر يعدّل أي تعريب', () => {
    expect(canEditMod({ ...baseUser, role: 'member' }, { authorId: 'user-1' })).toBe(false)
  })
})

describe('canDelete', () => {
  const baseUser = { id: 'user-1', username: 'test', email: 't@t.com', role: 'creator' as const, avatarUrl: null, onboardingCompleted: true }

  it('admin يقدر يحذف', () => {
    expect(canDelete({ ...baseUser, role: 'admin' })).toBe(true)
  })

  it('owner يقدر يحذف', () => {
    expect(canDelete({ ...baseUser, role: 'owner' })).toBe(true)
  })

  it('moderator ما يقدر يحذف', () => {
    expect(canDelete({ ...baseUser, role: 'moderator' })).toBe(false)
  })

  it('member ما يقدر يحذف', () => {
    expect(canDelete({ ...baseUser, role: 'member' })).toBe(false)
  })
})

describe('getBanStatus', () => {
  it('active → غير محظور', () => {
    const result = getBanStatus({ banStatus: 'active' })
    expect(result.banned).toBe(false)
    expect(result.type).toBeNull()
  })

  it('banned_perm → محظور دائماً', () => {
    const result = getBanStatus({ banStatus: 'banned_perm', banReason: 'خطير' })
    expect(result.banned).toBe(true)
    expect(result.type).toBe('perm')
    expect(result.reason).toBe('خطير')
  })

  it('banned_temp مع تاريخ منتهي → غير محظور', () => {
    const past = new Date('2020-01-01')
    const result = getBanStatus({ banStatus: 'banned_temp', bannedUntil: past })
    expect(result.banned).toBe(false)
  })

  it('banned_temp مع تاريخ لم ينتهِ → محظور مؤقتاً', () => {
    const future = new Date('2099-01-01')
    const result = getBanStatus({ banStatus: 'banned_temp', bannedUntil: future, banReason: 'مؤقت' })
    expect(result.banned).toBe(true)
    expect(result.type).toBe('temp')
    expect(result.expiresAt).toBe(future)
    expect(result.reason).toBe('مؤقت')
  })

  it('restricted → غير محظور لكن مقيّد', () => {
    const result = getBanStatus({ banStatus: 'restricted', banReason: 'مقيّد' })
    expect(result.banned).toBe(false)
    expect(result.reason).toBe('مقيّد')
  })

  it('بدون banStatus → غير محظور', () => {
    const result = getBanStatus({})
    expect(result.banned).toBe(false)
  })

  it('بدون banReason → reason null', () => {
    const result = getBanStatus({ banStatus: 'banned_perm' })
    expect(result.reason).toBeNull()
  })
})

describe('getClientIp', () => {
  it('يُرجع x-forwarded-for عندما يوجد', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }) }
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('يُرجع x-real-ip عندما لا يوجد x-forwarded-for', () => {
    const req = { headers: new Headers({ 'x-real-ip': '9.8.7.6' }) }
    expect(getClientIp(req)).toBe('9.8.7.6')
  })

  it('يُرجع unknown عندما لا يوجد أي header', () => {
    const req = { headers: new Headers() }
    expect(getClientIp(req)).toBe('unknown')
  })

  it('يُعامل x-forwarded-for مع مسافات', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '  10.0.0.1 , 10.0.0.2' }) }
    expect(getClientIp(req)).toBe('10.0.0.1')
  })
})

describe('getUserIdFromRequestCookies', () => {
  it('يُرجع userId من الكوكي', async () => {
    const cookiePayload = { userId: 'user-42', role: 'admin' }
    const token = await createRoleCookie(cookiePayload)
    const req = new Request('http://localhost', {
      headers: { cookie: `ga_admin_role=${token}` },
    })
    const userId = await getUserIdFromRequestCookies(req)
    expect(userId).toBe('user-42')
  })

  it('يُرجع null عندما لا يوجد كوكي', async () => {
    const req = new Request('http://localhost')
    const userId = await getUserIdFromRequestCookies(req)
    expect(userId).toBeNull()
  })

  it('يُرجع null عندما يكون الكوكي غير صالح', async () => {
    const req = new Request('http://localhost', {
      headers: { cookie: 'ga_admin_role=invalid-token' },
    })
    const userId = await getUserIdFromRequestCookies(req)
    expect(userId).toBeNull()
  })

  it('يُرجع null عندما لا يوجد userId في الـ JWT', async () => {
    const cookiePayload = { role: 'admin' }
    const token = await createRoleCookie(cookiePayload)
    const req = new Request('http://localhost', {
      headers: { cookie: `ga_admin_role=${token}` },
    })
    const userId = await getUserIdFromRequestCookies(req)
    expect(userId).toBeNull()
  })
})

describe('setRoleCookie', () => {
  it('يضع كوكي مع جميع الخيارات الصحيحة', async () => {
    const setFn = jest.fn()
    mockCookies.mockResolvedValue({
      get: jest.fn(),
      set: setFn,
      delete: jest.fn(),
    } as any)

    await setRoleCookie('user-1', 'admin', 5, false, true)

    expect(setFn).toHaveBeenCalledTimes(1)
    const [name, value, opts] = setFn.mock.calls[0]
    expect(name).toBe('ga_admin_role')
    expect(typeof value).toBe('string')
    expect(opts.httpOnly).toBe(true)
    expect(opts.sameSite).toBe('lax')
    expect(opts.path).toBe('/')
    expect(opts.maxAge).toBe(60 * 60 * 24 * 7)
  })

  it('يشمل tv و mfa و ob في الـ JWT payload', async () => {
    const setFn = jest.fn()
    mockCookies.mockResolvedValue({
      get: jest.fn(),
      set: setFn,
      delete: jest.fn(),
    } as any)

    await setRoleCookie('user-1', 'admin', 3, true, false)

    const [, value] = setFn.mock.calls[0]
    const { payload } = await jwtVerify(value as string, new TextEncoder().encode(process.env.JWT_SECRET!))
    expect(payload.userId).toBe('user-1')
    expect(payload.role).toBe('admin')
    expect(payload.tv).toBe(3)
    expect(payload.mfa).toBe(true)
    expect(payload.ob).toBe(false)
  })
})

describe('clearRoleCookie', () => {
  it('يمسح الكوكي مع maxAge = 0', async () => {
    const setFn = jest.fn()
    mockCookies.mockResolvedValue({
      get: jest.fn(),
      set: setFn,
      delete: jest.fn(),
    } as any)

    await clearRoleCookie()

    expect(setFn).toHaveBeenCalledTimes(1)
    const opts = setFn.mock.calls[0][0]
    expect(opts.name).toBe('ga_admin_role')
    expect(opts.value).toBe('')
    expect(opts.maxAge).toBe(0)
  })
})

describe('hashPassword', () => {
  it('يُرجع hash طويل', async () => {
    const hash = await hashPassword('mypassword')
    expect(hash).not.toBe('mypassword')
    expect(hash.length).toBeGreaterThan(20)
  })
})

describe('getJWTSecret', () => {
  it('يُرجع Uint8Array عندما JWT_SECRET موجود', () => {
    const secret = getJWTSecret()
    expect(secret).toBeInstanceOf(Uint8Array)
  })

  it('يرمي Error عندما JWT_SECRET غير موجود', () => {
    const original = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(() => getJWTSecret()).toThrow('JWT_SECRET environment variable is required')
    process.env.JWT_SECRET = original
  })
})

describe('invalidateUserSessions', () => {
  it('يزيد tokenVersion ويُخزنه في Redis', async () => {
    mockUpdate.mockResolvedValue({ tokenVersion: 6 })
    const result = await invalidateUserSessions('user-1')
    expect(result).toBe(6)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })
    expect(mockSetTokenVersionCache).toHaveBeenCalledWith('user-1', 6)
  })

  it('يُرجع -1 عند الفشل', async () => {
    mockUpdate.mockRejectedValue(new Error('DB error'))
    const result = await invalidateUserSessions('user-1')
    expect(result).toBe(-1)
  })
})

describe('getOptionalSession', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يُرجع المستخدم عندما يكون مسجلاً', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser(DB_USER_ROW)
    mockCookieStore(undefined)
    const session = await getOptionalSession()
    expect(session).not.toBeNull()
    expect(session!.id).toBe('user-1')
  })

  it('يُرجع null عندما لا يوجد جلسة', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    mockCookieStore(undefined)
    const session = await getOptionalSession()
    expect(session).toBeNull()
  })

  it('يُرجع null عند الخطأ', async () => {
    mockHeaderStore(null)
    mockCreateClient.mockRejectedValue(new Error('boom'))
    mockCookieStore(undefined)
    const session = await getOptionalSession()
    expect(session).toBeNull()
  })
})

describe('getBanInfo', () => {
  beforeEach(() => jest.clearAllMocks())

  it('يُرجع معلومات الحظر للمستخدم المحظور', async () => {
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockFindFirst.mockResolvedValue({
      username: 'testuser',
      banStatus: 'banned_perm',
      bannedUntil: null,
      banReason: 'خطير',
    })
    const info = await getBanInfo()
    expect(info).not.toBeNull()
    expect(info!.banned).toBe(true)
    expect(info!.type).toBe('perm')
    expect(info!.reason).toBe('خطير')
    expect(info!.username).toBe('testuser')
  })

  it('يُرجع null للمستخدم غير المحظور', async () => {
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockFindFirst.mockResolvedValue({
      username: 'testuser',
      banStatus: 'active',
      bannedUntil: null,
      banReason: null,
    })
    const info = await getBanInfo()
    expect(info).toBeNull()
  })

  it('يُرجع null عندما لا يوجد Supabase user', async () => {
    mockSupabaseUser(null)
    const info = await getBanInfo()
    expect(info).toBeNull()
  })

  it('يُرجع null عندما لا يوجد مستخدم في DB', async () => {
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockFindFirst.mockResolvedValue(null)
    const info = await getBanInfo()
    expect(info).toBeNull()
  })

  it('يُرجع null عند الخطأ', async () => {
    mockCreateClient.mockRejectedValue(new Error('boom'))
    const info = await getBanInfo()
    expect(info).toBeNull()
  })
})

describe('createSupabaseAuthUser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  })

  it('يُرجع null عندما لا يوجد SUPABASE_SERVICE_ROLE_KEY', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const result = await createSupabaseAuthUser('test@example.com', 'pass', 'user')
    expect(result).toBeNull()
  })

  it('يُرجع null عندما يكون المفتاح placeholder', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'REPLACE_WITH_SERVICE_ROLE_KEY'
    const result = await createSupabaseAuthUser('test@example.com', 'pass', 'user')
    expect(result).toBeNull()
  })

  it('يُرجع null عند فشل الطلب', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'))
    const result = await createSupabaseAuthUser('test@example.com', 'pass', 'user')
    expect(result).toBeNull()
  })

  it('يُرجع null عندما يكون الرد غير ناجح', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false })
    const result = await createSupabaseAuthUser('test@example.com', 'pass', 'user')
    expect(result).toBeNull()
  })

  it('يُرجع userId عند النجاح', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 'new-supabase-id' }),
    })
    const result = await createSupabaseAuthUser('test@example.com', 'pass', 'user')
    expect(result).toBe('new-supabase-id')
  })
})

describe('requireCreatorStudio', () => {
  beforeEach(() => jest.clearAllMocks())

  function mockReq() {
    return { headers: new Headers() } as any
  }

  it('يُرجع user للمستخدم_creator', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'creator' })
    mockCookieStore(undefined)
    const result = await requireCreatorStudio(mockReq())
    expect(result.user).not.toBeNull()
    expect(result.user!.role).toBe('creator')
    expect(result.error).toBeNull()
  })

  it('يُرجع error للمستخدم member', async () => {
    mockHeaderStore(null)
    mockSupabaseUser({ id: 'supa-1', email: 'test@example.com' })
    mockDbUser({ ...DB_USER_ROW, role: 'member' })
    mockCookieStore(undefined)
    const result = await requireCreatorStudio(mockReq())
    expect(result.user).toBeNull()
    expect(result.error).not.toBeNull()
  })

  it('يُرجع error 401 للمستخدم غير المسجل', async () => {
    mockHeaderStore(null)
    mockSupabaseUser(null)
    mockCookieStore(undefined)
    const result = await requireCreatorStudio(mockReq())
    expect(result.user).toBeNull()
    expect(result.error).not.toBeNull()
  })
})

describe('AuthError', () => {
  it('يحتوي على status و name صحيحين', () => {
    const err = new AuthError('Forbidden', 403)
    expect(err.status).toBe(403)
    expect(err.name).toBe('AuthError')
    expect(err.message).toBe('Forbidden')
    expect(err).toBeInstanceOf(Error)
  })
})
