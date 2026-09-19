/**
 * Telegram-first P3/P4: Telegram recover flow + numeric-ID identity.
 *
 * - synthetic-address Telegram user requesting recovery → token minted,
 *   bot notified with the link, response stays generic ok
 * - synthetic user WITHOUT a link → no token, no bot call, same generic ok
 * - returning Telegram login looks up by NUMERIC providerAccountId and
 *   refreshes display fields on username change (linking untouched)
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

// ── recover route mocks ──
const mockUserFindUnique = jest.fn()
const mockOAuthFindFirst = jest.fn()
const mockPwDeleteMany = jest.fn()
const mockPwCreate = jest.fn()
const mockEvtCount = jest.fn()
const mockRouteNotify = jest.fn()
const mockLogAction = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...a: Array<never>) => mockUserFindUnique(...a),
      update: (...a: Array<never>) => mockDbUserUpdate(...a),
      upsert: jest.fn(),
    },
    oAuthAccount: {
      findFirst: (...a: Array<never>) => mockOAuthFindFirst(...a),
      findUnique: (...a: Array<never>) => mockOAuthFindUnique(...a),
      update: (...a: Array<never>) => mockOAuthUpdate(...a),
      create: jest.fn(),
    },
    session: { create: jest.fn(async () => ({ token: 'led', expiresAt: new Date() })) },
    passwordResetToken: {
      deleteMany: (...a: Array<never>) => mockPwDeleteMany(...a),
      create: (...a: Array<never>) => mockPwCreate(...a),
    },
    emailVerificationToken: { count: (...a: Array<never>) => mockEvtCount(...a) },
  },
}))

const mockOAuthFindUnique = jest.fn()
const mockOAuthUpdate = jest.fn()
const mockDbUserUpdate = jest.fn()
const mockDbUserFindByEmail = jest.fn()

jest.mock('@/lib/notification-router', () => ({
  routeNotification: (...a: Array<never>) => mockRouteNotify(...a),
  maybeSendLoginAlert: jest.fn(),
  siteUrl: () => 'https://test.local',
}))

jest.mock('@/lib/audit', () => ({ logAction: (...a: Array<never>) => mockLogAction(...a) }))
jest.mock('@/lib/ratelimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue(true) }))

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn().mockResolvedValue(null),
  getBanStatus: () => ({ banned: false }),
  setRoleCookie: jest.fn(),
}))

jest.mock('@/lib/username-generator', () => ({
  generateUniqueUsername: jest.fn(async (s: string) => s),
}))

import { POST as recoverPOST } from '@/app/api/auth/recover/route'
import { performTelegramLogin } from '@/lib/telegram-login'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let ip = 500
function req(path: string, body: unknown) {
  ip += 1
  return new NextRequest(`http://x${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.80.0.${ip}` },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRouteNotify.mockResolvedValue({ telegram: true, email: false })
  mockEvtCount.mockResolvedValue(0)
  mockPwDeleteMany.mockResolvedValue({ count: 0 })
  mockPwCreate.mockResolvedValue({ id: 'prt-1' })
})

describe('recover via Telegram bot', () => {
  const tgUser = {
    id: 'u-tg', username: 'tguser', email: 'telegram_777@telegram.local',
    supabaseId: null, emailVerified: false,
  }

  it('mints a token + notifies the bot, generic ok (no oracle)', async () => {
    mockUserFindUnique.mockResolvedValue(tgUser)
    mockOAuthFindFirst.mockResolvedValue({ providerAccountId: '777' })
    const res = await recoverPOST(req('/api/auth/recover', { email: 'telegram_777@telegram.local' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { success: true } })
    expect(mockPwCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u-tg' }),
    })
    expect(mockRouteNotify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-tg', type: 'password_reset' }),
    )
    const resetUrl = (mockRouteNotify.mock.calls[0][0] as { data: { resetUrl: string } }).data.resetUrl
    expect(resetUrl).toMatch(/^https?:\/\/[^/]+\/reset-password\?token=[0-9a-f]{64}$/)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'password_recovery_requested' }),
    )
  })

  it('synthetic user without a link → same generic ok, nothing minted', async () => {
    mockUserFindUnique.mockResolvedValue(tgUser)
    mockOAuthFindFirst.mockResolvedValue(null)
    const res = await recoverPOST(req('/api/auth/recover', { email: 'telegram_777@telegram.local' }))
    expect(res.status).toBe(200)
    expect(mockPwCreate).not.toHaveBeenCalled()
    expect(mockRouteNotify).not.toHaveBeenCalled()
  })
})

describe('numeric-ID identity (username changes)', () => {
  const linked = {
    providerUsername: 'oldhandle',
    user: {
      id: 'u-tg', username: 'tguser', email: 'telegram_777@telegram.local',
      role: 'member', avatarUrl: null, banStatus: 'active', bannedUntil: null,
      banReason: null, tokenVersion: 1, onboardingCompleted: true,
    },
  }

  function loginAs(username: string | null) {
    return performTelegramLogin(
      { telegramId: 777, firstName: 'New', lastName: 'Person', username, photoUrl: null },
      { ipAddress: '9.9.9.9', userAgent: 'UA' },
    )
  }

  beforeEach(() => {
    mockOAuthFindUnique.mockResolvedValue(linked)
    mockDbUserUpdate.mockImplementation(async ({ data }: any) => ({ ...linked.user, ...data }))
    mockDbUserFindByEmail.mockResolvedValue(null)
    // user.findUnique is shared with recover mocks — route by args below
    mockUserFindUnique.mockImplementation(async (args: any) => {
      if (args?.where?.email) return mockDbUserFindByEmail(args)
      return linked.user
    })
  })

  it('looks up by numeric providerAccountId (never username)', async () => {
    const out = await loginAs('newhandle')
    expect(out.ok).toBe(true)
    expect(mockOAuthFindUnique).toHaveBeenCalledWith({
      where: { provider_providerAccountId: { provider: 'telegram', providerAccountId: '777' } },
      include: expect.anything(),
    })
  })

  it('refreshes display fields on handle change, same account kept', async () => {
    const out = await loginAs('newhandle')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.user.id).toBe('u-tg')
    expect(mockOAuthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerUsername: 'newhandle' }) }),
    )
    expect(mockDbUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ displayName: 'New Person' }) }),
    )
  })

  it('unchanged handle → no display rewrite', async () => {
    mockOAuthFindUnique.mockResolvedValue({ ...linked, providerUsername: 'samehandle' })
    const out = await loginAs('samehandle')
    expect(out.ok).toBe(true)
    const displayWrites = mockDbUserUpdate.mock.calls.filter((c: any) =>
      Object.prototype.hasOwnProperty.call(c[0]?.data ?? {}, 'displayName'),
    )
    expect(displayWrites).toHaveLength(0)
  })
})
