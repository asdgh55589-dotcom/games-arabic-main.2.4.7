/**
 * Audit D.2 link-squatting fix: /api/settings/link-account must require
 * proof-of-ownership (Telegram HMAC payload or fresh Supabase Google
 * identity). Self-asserted providerAccountId alone is rejected.
 * Unlink last-method guard stays intact.
 */
const mockAuth = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockAuth(...a),
}))

const mockOAuth = { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() }
const mockUserFind = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { oAuthAccount: mockOAuth, user: { findUnique: (...a: unknown[]) => mockUserFind(...a) } },
}))

const mockGetUserById = jest.fn()
jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: mockGetUserById } } }),
}))

const mockVerifyTg = jest.fn()
const mockAuthDate = jest.fn(() => true)
jest.mock('@/lib/telegram-verify', () => ({
  verifyTelegramAuth: mockVerifyTg,
  isAuthDateValid: mockAuthDate,
}))

import { POST as linkPOST } from '@/app/api/settings/link-account/route'
import { POST as unlinkPOST } from '@/app/api/settings/unlink-account/route'

const USER = { id: 'u-1', username: 'ali', email: 'a@x', role: 'member', avatarUrl: null, onboardingCompleted: true }
const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function req(body: unknown) {
  return new NextRequest('http://x/api/settings/link-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue(USER)
  mockOAuth.findUnique.mockResolvedValue(null)
  mockOAuth.findFirst.mockResolvedValue(null)
  mockOAuth.create.mockImplementation((args: unknown) =>
    Promise.resolve({ id: 'oa-1', createdAt: new Date().toISOString(), ...((args as { data: object }).data || {}) }),
  )
  mockUserFind.mockResolvedValue({ supabaseId: 'supa-1' })
  mockVerifyTg.mockReturnValue(true)
})

describe('telegram proof', () => {
  const widget = { id: '777', first_name: 'A', auth_date: String(Math.floor(Date.now() / 1000)), hash: 'h' }

  it('no-proof (self-asserted id only) → 400, no write', async () => {
    const res = await linkPOST(req({ provider: 'telegram', providerAccountId: '777' }))
    expect(res.status).toBe(400)
    expect(mockOAuth.create).not.toHaveBeenCalled()
  })

  it('bad HMAC → 400, no write', async () => {
    mockVerifyTg.mockReturnValue(false)
    const res = await linkPOST(req({ provider: 'telegram', telegram: widget }))
    expect(res.status).toBe(400)
    expect(mockOAuth.create).not.toHaveBeenCalled()
  })

  it('valid HMAC links the VERIFIED id (ignores mismatched self-asserted id)', async () => {
    const res = await linkPOST(
      req({ provider: 'telegram', providerAccountId: 'attacker-picked', telegram: widget }),
    )
    expect(res.status).toBe(201)
    expect(mockOAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerAccountId: '777' }) }),
    )
  })
})

describe('google proof', () => {
  it('no Supabase google identity → 400, no write', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { identities: [{ provider: 'email' }] } }, error: null })
    const res = await linkPOST(req({ provider: 'google', providerAccountId: 'g-1' }))
    expect(res.status).toBe(400)
    expect(mockOAuth.create).not.toHaveBeenCalled()
  })

  it('mismatched sub → 400, no write', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { identities: [{ provider: 'google', identity_data: { sub: 'g-other' } }] } },
      error: null,
    })
    const res = await linkPOST(req({ provider: 'google', providerAccountId: 'g-1' }))
    expect(res.status).toBe(400)
    expect(mockOAuth.create).not.toHaveBeenCalled()
  })

  it('fresh matching google identity → 201', async () => {
    mockGetUserById.mockResolvedValue({
      data: { user: { identities: [{ provider: 'google', identity_data: { sub: 'g-1' } }] } },
      error: null,
    })
    const res = await linkPOST(req({ provider: 'google', providerAccountId: 'g-1' }))
    expect(res.status).toBe(201)
    expect(mockOAuth.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ providerAccountId: 'g-1' }) }),
    )
  })
})

describe('unlink last-method guard (unchanged)', () => {
  function unlinkReq(body: unknown) {
    return new NextRequest('http://x/api/settings/unlink-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('refuses to unlink the last method', async () => {
    mockOAuth.findUnique.mockResolvedValue({ id: 'oa-1', userId: 'u-1' })
    mockOAuth.count.mockResolvedValue(1)
    const res = await unlinkPOST(unlinkReq({ accountId: 'oa-1' }))
    expect(res.status).toBe(400)
  })
})
