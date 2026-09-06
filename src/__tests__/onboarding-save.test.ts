/**
 * Tests for PATCH /api/auth/onboarding (D.6-b2).
 * Saves onboarding profile fields + sets the first password.
 */

const mockRequireAuth = jest.fn()
const mockFindUnique = jest.fn()
const mockUserUpdate = jest.fn()
const mockGetUser = jest.fn()
const mockUpdateUser = jest.fn()
const mockAdminCreateUser = jest.fn()
const mockAdminUpdateUser = jest.fn()
const mockAdminGetUser = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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
  createClient: jest.fn(async () => ({ auth: { getUser: mockGetUser, updateUser: mockUpdateUser } })),
  createAdminClient: jest.fn(() => ({
    auth: {
      admin: {
        createUser: mockAdminCreateUser,
        updateUserById: mockAdminUpdateUser,
        getUserById: mockAdminGetUser,
      },
    },
  })),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn() }))

import { PATCH } from '@/app/api/auth/onboarding/route'

const sessionUser = {
  id: 'u1',
  role: 'member',
  username: 'auto_user',
  email: 'user@gmail.com',
}

const neonUser = {
  id: 'u1',
  username: 'auto_user',
  displayName: null,
  email: 'user@gmail.com',
  supabaseId: 'supa-1',
  role: 'member',
}

function patchReq(body: unknown) {
  return { json: async () => body } as never
}

describe('PATCH /api/auth/onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ ...sessionUser })
    mockFindUnique.mockResolvedValue({ ...neonUser })
    mockUserUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...neonUser,
      ...args.data,
    }))
    mockGetUser.mockResolvedValue({ data: { user: { id: 'supa-1' } } })
    mockUpdateUser.mockResolvedValue({ error: null })
  })

  it('updates displayName and username for a Google user', async () => {
    const res = await PATCH(patchReq({ displayName: 'أحمد', username: 'ahmed_9' }))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ displayName: 'أحمد', username: 'ahmed_9' }),
      }),
    )
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
  })

  it('returns 409 with suggestion when username is taken', async () => {
    mockFindUnique.mockImplementation(async (args: { where: Record<string, string> }) => {
      if (args.where.username === 'taken') return { id: 'other' }
      if (args.where.username) return null
      return { ...neonUser }
    })
    const res = await PATCH(patchReq({ username: 'taken' }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(JSON.stringify(body)).toContain('suggestion')
  })

  it('rejects email change for users with a real (non-synthetic) email', async () => {
    const res = await PATCH(patchReq({ email: 'new@mail.com' }))
    expect(res.status).toBe(422)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('sets password via Supabase session for Google users', async () => {
    const res = await PATCH(patchReq({ password: 'StrongPass123' }))
    expect(res.status).toBe(200)
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'StrongPass123' })
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
  })

  it('creates a Supabase user + links it for Telegram users with a new real email', async () => {
    mockFindUnique.mockResolvedValue({ ...neonUser, email: 'telegram_5@telegram.local', supabaseId: null })
    mockGetUser.mockResolvedValue({ data: { user: null } })
    mockAdminCreateUser.mockResolvedValue({ data: { user: { id: 'supa-new' } }, error: null })

    const res = await PATCH(patchReq({ email: 'real@mail.com', password: 'StrongPass123' }))
    expect(res.status).toBe(200)
    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'real@mail.com', password: 'StrongPass123' }),
    )
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'real@mail.com', supabaseId: 'supa-new' }),
      }),
    )
  })

  it('rejects password without a real email for fresh Telegram users', async () => {
    mockFindUnique.mockResolvedValue({ ...neonUser, email: 'telegram_5@telegram.local', supabaseId: null })
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const res = await PATCH(patchReq({ password: 'StrongPass123' }))
    expect(res.status).toBe(422)
    expect(mockAdminCreateUser).not.toHaveBeenCalled()
  })

  it('validates password length', async () => {
    const res = await PATCH(patchReq({ password: 'short' }))
    expect(res.status).toBe(422)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    const res = await PATCH(patchReq({ displayName: 'x' }))
    expect(res.status).toBe(401)
  })
})
