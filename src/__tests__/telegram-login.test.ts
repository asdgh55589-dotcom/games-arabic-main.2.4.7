/**
 * Tests for the canonical Telegram login (D.1 slice 3).
 *
 * Four route copies of performLogin (telegram/route, telegram/callback,
 * telegram/poll, telegram-bridge) are unified into performTelegramLogin in
 * @/lib/telegram-login. These tests lock the canonical behavior:
 * reuse-by-link, attach-link-by-synthetic-email, create, ban gate, ledger.
 */

process.env.JWT_SECRET = 'test-secret-key-for-jest'

const mockOAFindUnique = jest.fn()
const mockOACreate = jest.fn()
const mockUserFindUnique = jest.fn()
const mockUserUpsert = jest.fn()
const mockUserUpdate = jest.fn()
const mockSessionCreate = jest.fn()
const mockSetRoleCookie = jest.fn()
const mockLogAction = jest.fn()
const mockGetBanStatus = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    oAuthAccount: {
      findUnique: (...args: unknown[]) => mockOAFindUnique(...args),
      create: (...args: unknown[]) => mockOACreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      upsert: (...args: unknown[]) => mockUserUpsert(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    session: {
      create: (...args: unknown[]) => mockSessionCreate(...args),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  getBanStatus: (...args: unknown[]) => mockGetBanStatus(...args),
  setRoleCookie: (...args: unknown[]) => mockSetRoleCookie(...args),
}))

jest.mock('@/lib/audit', () => ({
  logAction: (...args: unknown[]) => mockLogAction(...args),
}))

import { performTelegramLogin } from '@/lib/telegram-login'

const baseUserData = {
  telegramId: 123456789,
  firstName: 'Ahmed',
  lastName: 'Ali',
  username: 'ahmed_ali',
  photoUrl: 'https://example.com/photo.jpg',
}

function dbUser(overrides = {}) {
  return {
    id: 'user-1',
    username: 'ahmed_ali',
    email: 'telegram_123456789@telegram.local',
    role: 'member',
    avatarUrl: 'https://example.com/old.jpg',
    banStatus: 'active',
    bannedUntil: null,
    banReason: null,
    tokenVersion: 0,
    ...overrides,
  }
}

describe('performTelegramLogin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetBanStatus.mockReturnValue({ banned: false })
  })

  it('reuses the user behind an existing telegram link without creating anything', async () => {
    const user = dbUser()
    mockOAFindUnique.mockResolvedValue({ user })
    // stored avatar differs from the fresh photo → refresh path runs
    mockUserUpdate.mockImplementation(async (args: any) => ({ ...user, ...args.data }))

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.user.id).toBe('user-1')
    expect(mockUserUpsert).not.toHaveBeenCalled()
    expect(mockOACreate).not.toHaveBeenCalled()
    expect(mockSetRoleCookie).toHaveBeenCalledWith('user-1', 'member', 0)
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', action: 'login' }),
    )
    // ledger row created for the session
    expect(mockSessionCreate).toHaveBeenCalledTimes(1)
    expect(result.ledgerToken).toMatch(/^[0-9a-f]{64}$/)
  })

  it('updates the avatar when the stored one is missing', async () => {
    const user = dbUser({ avatarUrl: null })
    mockOAFindUnique.mockResolvedValue({ user })
    mockUserUpdate.mockImplementation(async (args: any) => ({ ...user, ...args.data }))

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(true)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    )
  })

  it('attaches a link when the synthetic-email user exists without one', async () => {
    mockOAFindUnique.mockResolvedValue(null)
    const user = dbUser()
    mockUserFindUnique.mockResolvedValue(user)
    mockOACreate.mockResolvedValue({ id: 'oa-1' })

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(true)
    expect(mockOACreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          provider: 'telegram',
          providerAccountId: '123456789',
        }),
      }),
    )
    expect(mockUserUpsert).not.toHaveBeenCalled()
  })

  it('creates user + link + ledger with displayName for a fresh telegram id', async () => {
    mockOAFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue(null) // link-attach lookup + username dedupe
    const created = dbUser({ id: 'user-new', displayName: 'Ahmed Ali' })
    mockUserUpsert.mockResolvedValue(created)
    mockOACreate.mockResolvedValue({ id: 'oa-new' })

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(true)
    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'telegram_123456789@telegram.local' },
      }),
    )
    const createData = mockUserUpsert.mock.calls[0][0].create
    expect(createData.displayName).toBe('Ahmed Ali')
    expect(createData.role).toBe('member')
    expect(mockOACreate).toHaveBeenCalledTimes(1)
    expect(mockSessionCreate).toHaveBeenCalledTimes(1)
  })

  it('refuses banned users without setting cookies or bumping loginCount', async () => {
    mockOAFindUnique.mockResolvedValue({ user: dbUser() })
    mockGetBanStatus.mockReturnValue({ banned: true })

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe('banned')
    expect(mockSetRoleCookie).not.toHaveBeenCalled()
    expect(mockSessionCreate).not.toHaveBeenCalled()
  })

  it('still logs in when ledger creation fails (fail-soft, no ledger cookie)', async () => {
    mockOAFindUnique.mockResolvedValue({ user: dbUser() })
    mockSessionCreate.mockRejectedValue(new Error('db down'))

    const result = await performTelegramLogin(baseUserData, {})

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ledgerToken).toBeNull()
    expect(mockSetRoleCookie).toHaveBeenCalled()
  })
})
