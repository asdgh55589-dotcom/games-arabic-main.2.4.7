/**
 * Technical-duplicate protection (E2E verification pass) + stale-session rejection.
 *
 * Rules pinned here:
 * - SAME Google sub → SAME local account (no second account, no second link row)
 * - DIFFERENT Google subs → different accounts allowed (legitimate)
 * - SAME Telegram ID → SAME local account even if the TG username changed
 * - DIFFERENT Telegram IDs → different accounts allowed (legitimate)
 * - Telegram username is NEVER the primary match key
 * - A role cookie with a stale tokenVersion is rejected immediately
 *
 * RED phase — written before verification; duplicates are prevented by
 * unique constraints + lookup order, asserted here end-to-end.
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

// Override the global jose mock with real HMAC functionality (same pattern
// as auth-lib.test.ts) so stale-tv rejection is proven with real signatures.
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
  cookies: jest.fn().mockResolvedValue({ get: jest.fn(), set: jest.fn() }),
  headers: jest.fn(() => {
    throw new Error('no headers in test')
  }),
}))

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 19, resetAt: 0, limit: 20 }),
  rateLimitHeaders: jest.fn().mockReturnValue({}),
}))

let nameCounter = 0
jest.mock('@/lib/username-generator', () => ({
  generateUniqueUsername: jest.fn(() => Promise.resolve(`gen-user-${nameCounter++}`)),
  generateUsernameFromEmail: jest.fn((email: string) =>
    Promise.resolve(`email-${String(email).split('@')[0]}`),
  ),
}))

const mockSetRoleCookie = jest.fn()
jest.mock('@/lib/auth', () => ({
  ...jest.requireActual('@/lib/auth'),
  setRoleCookie: (...a: Array<never>) => mockSetRoleCookie(...a),
}))

// ---------- stateful in-memory DB fake ----------
interface FakeUser {
  id: string
  supabaseId: string | null
  username: string
  email: string
  password: string | null
  role: string
  avatarUrl: string | null
  displayName: string | null
  banStatus: string
  bannedUntil: null
  banReason: null
  tokenVersion: number
  onboardingCompleted: boolean
}
interface FakeLink {
  provider: string
  providerAccountId: string
  userId: string
}
const users = new Map<string, FakeUser>()
const links: FakeLink[] = []
let idCounter = 0
const nid = (p: string) => `${p}-${++idCounter}`

function matchUser(where: Record<string, unknown>): FakeUser | null {
  for (const u of users.values()) {
    if (where.id !== undefined && u.id !== where.id) continue
    if (where.supabaseId !== undefined && u.supabaseId !== where.supabaseId) continue
    if (where.email !== undefined && u.email !== where.email) continue
    if (where.username !== undefined && u.username !== where.username) continue
    if (where.OR !== undefined) {
      const ors = where.OR as Array<Record<string, unknown>>
      const hit = ors.some((cond) => {
        if (cond.supabaseId !== undefined) return u.supabaseId === cond.supabaseId
        if (cond.email !== undefined) return u.email === cond.email
        return false
      })
      if (!hit) continue
    }
    return u
  }
  return null
}

function toLinkRow(userId: string, provider: string, providerAccountId: string) {
  return { userId, provider, providerAccountId, providerEmail: null, providerUsername: null, avatarUrl: null }
}

const dbFake = {
  user: {
    findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => matchUser(where)),
    findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) => matchUser(where)),
    create: jest.fn(async ({ data }: { data: Partial<FakeUser> }) => {
      const u: FakeUser = {
        id: nid('u'),
        supabaseId: (data.supabaseId as string) ?? null,
        username: data.username as string,
        email: (data.email as string).toLowerCase(),
        password: (data.password as string) ?? null,
        role: (data.role as string) ?? 'member',
        avatarUrl: (data.avatarUrl as string) ?? null,
        displayName: (data.displayName as string) ?? null,
        banStatus: 'active',
        bannedUntil: null,
        banReason: null,
        tokenVersion: 0,
        onboardingCompleted: false,
      }
      users.set(u.id, u)
      return u
    }),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => {
      const u = users.get(where.id)!
      Object.assign(u, data)
      return u
    }),
    upsert: jest.fn(
      async ({ where, create: c }: { where: { email: string }; create: Partial<FakeUser> }) => {
        const existing = matchUser({ email: (where.email as string).toLowerCase() })
        if (existing) return existing
        return dbFake.user.create({ data: c })
      },
    ),
  },
  oAuthAccount: {
    findUnique: jest.fn(
      async ({ where, include }: { where: { provider_providerAccountId: { provider: string; providerAccountId: string } }; include?: unknown }) => {
        const k = where.provider_providerAccountId
        const link = links.find(
          (l) => l.provider === k.provider && l.providerAccountId === k.providerAccountId,
        )
        if (!link) return null
        if (include) return { ...toLinkRow(link.userId, link.provider, link.providerAccountId), user: users.get(link.userId) }
        return toLinkRow(link.userId, link.provider, link.providerAccountId)
      },
    ),
    create: jest.fn(async ({ data }: { data: FakeLink }) => {
      links.push({ provider: data.provider, providerAccountId: data.providerAccountId, userId: data.userId })
      return data
    }),
  },
  session: {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
  },
  notificationPreference: { create: jest.fn(async () => ({})) },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ user: dbFake.user, oAuthAccount: dbFake.oAuthAccount, notificationPreference: dbFake.notificationPreference }),
  ),
}
jest.mock('@/lib/db', () => ({ db: dbFake }))

const mockExchange = jest.fn()
const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchange, getUser: mockSbGetUser },
  })),
  createAdminClient: jest.fn(() => null),
}))

import { SignJWT } from 'jose'
import { GET as callbackGET } from '@/app/api/auth/callback/route'
import { getSession } from '@/lib/auth'
import { performTelegramLogin } from '@/lib/telegram-login'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
const TEST_SECRET = new TextEncoder().encode('test-secret-key-for-jest')

beforeEach(() => {
  users.clear()
  links.length = 0
  idCounter = 0
  nameCounter = 0
  jest.clearAllMocks()
  mockExchange.mockResolvedValue({ error: null })
})

function sbGoogle(sub: string, email: string) {
  return {
    id: sub,
    email,
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'G User', picture: null },
  }
}

function callbackReq(ip: string) {
  return new NextRequest('http://x/api/auth/callback?code=c&next=/', {
    method: 'GET',
    headers: { 'x-forwarded-for': ip, host: 'x' },
  })
}

async function googleLogin(sub: string, email: string, ip: string) {
  mockSbGetUser.mockResolvedValue({ data: { user: sbGoogle(sub, email) } })
  return callbackGET(callbackReq(ip))
}

describe('Google technical duplicates', () => {
  it('SAME sub logging in twice routes to ONE account (no second user, no second link)', async () => {
    const r1 = await googleLogin('sub-A', 'a@gmail.com', '10.0.0.1')
    expect(r1.status).toBe(307)
    expect(users.size).toBe(1)
    expect(links.length).toBe(1)
    const firstId = mockSetRoleCookie.mock.calls[0][0]

    const r2 = await googleLogin('sub-A', 'a@gmail.com', '10.0.0.2')
    expect(r2.status).toBe(307)
    expect(users.size).toBe(1)
    expect(links.length).toBe(1)
    expect(mockSetRoleCookie.mock.calls[1][0]).toBe(firstId)
  })

  it('DIFFERENT subs create DIFFERENT accounts (legitimate, allowed)', async () => {
    await googleLogin('sub-A', 'a@gmail.com', '10.0.0.3')
    await googleLogin('sub-B', 'b@gmail.com', '10.0.0.4')
    expect(users.size).toBe(2)
    expect(links.length).toBe(2)
    const ids = mockSetRoleCookie.mock.calls.map((c) => c[0])
    expect(new Set(ids).size).toBe(2)
  })

  it('same email with a DIFFERENT sub is blocked (no account takeover via email)', async () => {
    await googleLogin('sub-A', 'a@gmail.com', '10.0.0.5')
    const r = await googleLogin('sub-EVIL', 'a@gmail.com', '10.0.0.6')
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).toContain('email_exists_link_accounts')
    expect(users.size).toBe(1)
  })

  it('OAuth failures do not enumerate local users (generic redirects, no bodies)', async () => {
    mockExchange.mockResolvedValueOnce({ error: { message: 'bad code' } })
    mockSbGetUser.mockResolvedValue({ data: { user: sbGoogle('sub-X', 'x@gmail.com') } })
    const r = await callbackGET(callbackReq('10.0.0.7'))
    expect(r.status).toBe(307)
    expect(r.headers.get('location')).not.toContain('x@gmail.com')
    expect(users.size).toBe(0)
  })
})

describe('Telegram technical duplicates', () => {
  const ctx = { ipAddress: '10.1.0.1', userAgent: 'test' }

  it('SAME Telegram ID reuses ONE account even when the TG username changed', async () => {
    const first = await performTelegramLogin(
      { telegramId: 123, firstName: 'Old', username: 'old_name', photoUrl: null },
      ctx,
    )
    expect(first.ok).toBe(true)
    const second = await performTelegramLogin(
      { telegramId: 123, firstName: 'New', username: 'new_name', photoUrl: null },
      ctx,
    )
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) expect(second.user.id).toBe(first.user.id)
    expect(users.size).toBe(1)
    expect(links.length).toBe(1)
  })

  it('DIFFERENT Telegram IDs create DIFFERENT accounts (legitimate, allowed)', async () => {
    const a = await performTelegramLogin({ telegramId: 111, firstName: 'A', photoUrl: null }, ctx)
    const b = await performTelegramLogin({ telegramId: 222, firstName: 'B', photoUrl: null }, ctx)
    expect(a.ok && b.ok).toBe(true)
    if (a.ok && b.ok) expect(a.user.id).not.toBe(b.user.id)
    expect(users.size).toBe(2)
  })

  it('Telegram login never matches by username (ID is the stable key)', async () => {
    await performTelegramLogin(
      { telegramId: 555, firstName: 'X', username: 'shared_handle', photoUrl: null },
      ctx,
    )
    // Same handle, different ID → must be a NEW account, not a takeover.
    const other = await performTelegramLogin(
      { telegramId: 666, firstName: 'Y', username: 'shared_handle', photoUrl: null },
      ctx,
    )
    expect(other.ok).toBe(true)
    expect(users.size).toBe(2)
  })
})

describe('stale role cookie rejected immediately', () => {
  it('tokenVersion mismatch → getSession null (old cookie dead on arrival)', async () => {
    users.set('u-9', {
      id: 'u-9', supabaseId: null, username: 'stale', email: 's@m.io', password: null,
      role: 'member', avatarUrl: null, displayName: null, banStatus: 'active',
      bannedUntil: null, banReason: null, tokenVersion: 2, onboardingCompleted: true,
    })
    const staleJwt = await new SignJWT({ userId: 'u-9', role: 'member', tv: 1, ob: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(TEST_SECRET)

    const { cookies } = require('next/headers')
    cookies.mockResolvedValue({
      get: (name: string) => (name === 'ga_admin_role' ? { value: staleJwt } : undefined),
      set: jest.fn(),
    })
    mockSbGetUser.mockResolvedValue({ data: { user: null } })

    await expect(getSession()).resolves.toBeNull()
  })

  it('matching tokenVersion still authenticates (mechanism is precise, not blanket-null)', async () => {
    users.set('u-9', {
      id: 'u-9', supabaseId: null, username: 'fresh', email: 'f@m.io', password: null,
      role: 'member', avatarUrl: null, displayName: null, banStatus: 'active',
      bannedUntil: null, banReason: null, tokenVersion: 2, onboardingCompleted: true,
    })
    const freshJwt = await new SignJWT({ userId: 'u-9', role: 'member', tv: 2, ob: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(TEST_SECRET)

    const { cookies } = require('next/headers')
    cookies.mockResolvedValue({
      get: (name: string) => (name === 'ga_admin_role' ? { value: freshJwt } : undefined),
      set: jest.fn(),
    })
    mockSbGetUser.mockResolvedValue({ data: { user: null } })

    const session = await getSession()
    expect(session?.id).toBe('u-9')
  })
})
