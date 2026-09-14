/**
 * Tests for POST /api/auth/recover + POST /api/auth/reset-password (D.6-c).
 * Generic responses (anti-enumeration), single-use 1h tokens, tv-bump.
 */

const mockRateLimit = jest.fn()
const mockFindUser = jest.fn()
const mockTokenFind = jest.fn()
const mockTokenCreate = jest.fn()
const mockTokenDeleteMany = jest.fn()
const mockTokenUpdate = jest.fn()
const mockInvalidateSessions = jest.fn()
const mockAdminUpdateUser = jest.fn()
const mockSendResetEmail = jest.fn()

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  rateLimitHeaders: () => ({}),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...args: unknown[]) => mockFindUser(...args) },
    passwordResetToken: {
      findUnique: (...args: unknown[]) => mockTokenFind(...args),
      create: (...args: unknown[]) => mockTokenCreate(...args),
      deleteMany: (...args: unknown[]) => mockTokenDeleteMany(...args),
      update: (...args: unknown[]) => mockTokenUpdate(...args),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  invalidateUserSessions: (...args: unknown[]) => mockInvalidateSessions(...args),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(() => ({
    auth: { admin: { updateUserById: mockAdminUpdateUser } },
  })),
}))

jest.mock('@/lib/recovery-email', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendResetEmail(...args),
  buildResetLink: (base: string, token: string) => `${base}/reset-password?token=${token}`,
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

import { POST as recoverPOST } from '@/app/api/auth/recover/route'
import { POST as resetPOST } from '@/app/api/auth/reset-password/route'

function postReq(body: unknown) {
  return { json: async () => body, headers: new Headers() } as never
}

const eligibleUser = {
  id: 'u1',
  username: 'ahmed',
  email: 'user@gmail.com',
  supabaseId: 'supa-1',
}

describe('POST /api/auth/recover', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockSendResetEmail.mockResolvedValue(true)
  })

  it('returns generic ok for unknown emails without creating anything', async () => {
    mockFindUser.mockResolvedValue(null)
    const res = await recoverPOST(postReq({ email: 'nobody@mail.com' }))
    expect(res.status).toBe(200)
    expect(mockTokenCreate).not.toHaveBeenCalled()
    expect(mockSendResetEmail).not.toHaveBeenCalled()
  })

  it('creates a 1h hashed token and emails it for eligible users', async () => {
    mockFindUser.mockResolvedValue({ ...eligibleUser })
    mockTokenCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => args.data)

    const res = await recoverPOST(postReq({ email: 'user@gmail.com' }))
    expect(res.status).toBe(200)
    expect(mockTokenDeleteMany).toHaveBeenCalledTimes(1)
    expect(mockTokenCreate).toHaveBeenCalledTimes(1)
    const data = mockTokenCreate.mock.calls[0][0].data
    expect(data.userId).toBe('u1')
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    const ttlMs = new Date(data.expiresAt).getTime() - Date.now()
    expect(ttlMs).toBeGreaterThan(50 * 60 * 1000)
    expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000)
    expect(mockSendResetEmail).toHaveBeenCalledWith(
      'user@gmail.com',
      expect.stringContaining('/reset-password?token='),
    )
  })

  it('stays generic for synthetic emails and users without Supabase identity', async () => {
    for (const u of [
      { ...eligibleUser, email: 'telegram_5@telegram.local' },
      { ...eligibleUser, supabaseId: null },
    ]) {
      jest.clearAllMocks()
      mockRateLimit.mockResolvedValue({ success: true })
      mockFindUser.mockResolvedValue(u)
      const res = await recoverPOST(postReq({ email: u.email }))
      expect(res.status).toBe(200)
      expect(mockTokenCreate).not.toHaveBeenCalled()
      expect(mockSendResetEmail).not.toHaveBeenCalled()
    }
  })

  it('rejects malformed emails and rate-limited callers', async () => {
    const bad = await recoverPOST(postReq({ email: 'not-an-email' }))
    expect(bad.status).toBe(422)
    mockRateLimit.mockResolvedValue({ success: false, limit: 5, remaining: 0, resetAt: 0 })
    const limited = await recoverPOST(postReq({ email: 'user@gmail.com' }))
    expect(limited.status).toBe(429)
  })
})

describe('POST /api/auth/reset-password', () => {
  const tokenRow = (overrides = {}) => ({
    id: 't1',
    userId: 'u1',
    tokenHash: 'a'.repeat(64),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    user: { ...eligibleUser },
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockAdminUpdateUser.mockResolvedValue({ error: null })
    mockInvalidateSessions.mockResolvedValue(1)
  })

  it('resets via Supabase, marks single-use, bumps tokenVersion', async () => {
    mockTokenFind.mockResolvedValue(tokenRow())
    const res = await resetPOST(postReq({ token: 'raw-token-0123456789abcdef', password: 'NewStrong123' }))
    expect(res.status).toBe(200)
    expect(mockAdminUpdateUser).toHaveBeenCalledWith('supa-1', { password: 'NewStrong123' })
    expect(mockTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 't1' }, data: expect.objectContaining({}) }),
    )
    const updateData = mockTokenUpdate.mock.calls[0][0].data
    expect(updateData.usedAt).toBeInstanceOf(Date)
    expect(mockInvalidateSessions).toHaveBeenCalledWith('u1')
  })

  it('rejects expired, used, and unknown tokens identically', async () => {
    const cases = [
      tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      tokenRow({ usedAt: new Date() }),
      null,
    ]
    for (const row of cases) {
      jest.clearAllMocks()
      mockRateLimit.mockResolvedValue({ success: true })
      mockTokenFind.mockResolvedValue(row)
      const res = await resetPOST(postReq({ token: 'raw-token-0123456789abcdef', password: 'NewStrong123' }))
      expect(res.status).toBe(422)
    }
    expect(mockAdminUpdateUser).not.toHaveBeenCalled()
    expect(mockInvalidateSessions).not.toHaveBeenCalled()
  })

  it('rejects weak passwords and accounts without Supabase identity', async () => {
    mockTokenFind.mockResolvedValue(tokenRow())
    const weak = await resetPOST(postReq({ token: 'tok-0123456789abcdef', password: 'short' }))
    expect(weak.status).toBe(422)

    mockTokenFind.mockResolvedValue(tokenRow({ user: { ...eligibleUser, supabaseId: null } }))
    const noSupa = await resetPOST(postReq({ token: 'tok-0123456789abcdef', password: 'NewStrong123' }))
    expect(noSupa.status).toBe(422)
    expect(mockAdminUpdateUser).not.toHaveBeenCalled()
  })
})
