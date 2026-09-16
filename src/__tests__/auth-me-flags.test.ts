/**
 * /api/auth/me exposes the flags the settings UI gates on.
 *
 * - hasPassword: true only when a Neon hash exists (hash itself NEVER serialized)
 * - needsSecuritySetup: true when no password OR synthetic Telegram email
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({ get: jest.fn(), set: jest.fn() }),
}))

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockFindFirst = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findFirst: (...a: Array<never>) => mockFindFirst(...a) } },
}))

const mockSbGetUser = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: mockSbGetUser } })),
}))

import { GET as meGET } from '@/app/api/auth/me/route'

beforeEach(() => {
  jest.clearAllMocks()
  mockSbGetUser.mockResolvedValue({ data: { user: { id: 'sb-1', email: 'e@m.io' } } })
})

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u-1', username: 'u', email: 'e@m.io', password: 'hash', role: 'member',
    avatarUrl: null, bannerUrl: null, bio: null, joinedAt: new Date().toISOString(),
    banStatus: 'active', bannedUntil: null, banReason: null, onboardingCompleted: true,
    ...overrides,
  }
}

describe('GET /api/auth/me security flags', () => {
  it('reports hasPassword + setup-complete for a fully set-up user (no hash leaked)', async () => {
    mockFindFirst.mockResolvedValue(row({ password: 'bcrypt-hash', email: 'e@m.io' }))
    const res = await meGET()
    const body = (await res.json()) as { data: { user: Record<string, unknown> } }
    expect(body.data.user.hasPassword).toBe(true)
    expect(body.data.user.needsSecuritySetup).toBe(false)
    expect(body.data.user).not.toHaveProperty('password')
  })

  it('flags OAuth-only users as needing setup', async () => {
    mockFindFirst.mockResolvedValue(row({ password: null, email: 'telegram_5@telegram.local' }))
    const res = await meGET()
    const body = (await res.json()) as { data: { user: Record<string, unknown> } }
    expect(body.data.user.hasPassword).toBe(false)
    expect(body.data.user.needsSecuritySetup).toBe(true)
  })
})
