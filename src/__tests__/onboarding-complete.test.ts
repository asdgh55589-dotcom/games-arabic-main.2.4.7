/**
 * Tests for POST /api/auth/onboarding/complete (D.6-b3).
 * Verifies readiness, flips the flag, re-issues the cookie with ob:true.
 */

const mockRequireAuth = jest.fn()
const mockSetRoleCookie = jest.fn()
const mockFindUnique = jest.fn()
const mockUserUpdate = jest.fn()
const mockAdminGetUser = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  setRoleCookie: (...args: unknown[]) => mockSetRoleCookie(...args),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
  createAdminClient: jest.fn(() => ({
    auth: { admin: { getUserById: mockAdminGetUser } },
  })),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

import { POST } from '@/app/api/auth/onboarding/complete/route'

const readyUser = {
  id: 'u1',
  username: 'ahmed_9',
  displayName: 'أحمد',
  email: 'user@gmail.com',
  supabaseId: 'supa-1',
  role: 'member',
  tokenVersion: 0,
  onboardingCompleted: false,
}

function authed() {
  mockRequireAuth.mockResolvedValue({ id: 'u1', role: 'member' })
  mockFindUnique.mockResolvedValue({ ...readyUser })
  mockUserUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    ...readyUser,
    ...args.data,
  }))
  mockAdminGetUser.mockResolvedValue({
    data: { user: { id: 'supa-1', identities: [{ provider: 'email' }] } },
    error: null,
  })
}

describe('POST /api/auth/onboarding/complete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    authed()
  })

  it('flips the flag and re-issues the cookie with ob:true when ready', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { onboardingCompleted: true } }),
    )
    expect(mockSetRoleCookie).toHaveBeenCalledWith('u1', 'member', 0, false, true)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('true')
  })

  it('rejects when displayName is missing (profile never confirmed)', async () => {
    mockFindUnique.mockResolvedValue({ ...readyUser, displayName: null })
    const res = await POST()
    expect(res.status).toBe(422)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('rejects when no Supabase identity exists (password never set)', async () => {
    mockFindUnique.mockResolvedValue({ ...readyUser, supabaseId: null })
    const res = await POST()
    expect(res.status).toBe(422)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('rejects when the Supabase user has no email credential (OAuth-only)', async () => {
    mockAdminGetUser.mockResolvedValue({
      data: { user: { id: 'supa-1', identities: [{ provider: 'google' }] } },
      error: null,
    })
    const res = await POST()
    expect(res.status).toBe(422)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('is idempotent: already-completed users get a fresh ob:true cookie', async () => {
    mockFindUnique.mockResolvedValue({ ...readyUser, onboardingCompleted: true })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockSetRoleCookie).toHaveBeenCalledWith('u1', 'member', 0, false, true)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    const res = await POST()
    expect(res.status).toBe(401)
  })
})
