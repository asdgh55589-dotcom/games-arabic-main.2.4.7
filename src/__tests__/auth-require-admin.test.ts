process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/token-version-cache', () => ({
  setTokenVersionCache: jest.fn(),
}))

const mockFindFirst = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: mockFindFirst,
    },
  },
}))

import { cookies } from 'next/headers'
import { AuthError, requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockCookies = cookies as jest.MockedFunction<typeof cookies>

describe('requireAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function mockSession(
    user: {
      id: string
      username: string
      email: string
      role: string
      avatarUrl: string | null
    } | null,
  ) {
    if (!user) {
      mockCreateClient.mockResolvedValue({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
      } as any)
      return
    }

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'supa-' + user.id, email: user.email } },
        }),
      },
    } as any)

    mockFindFirst.mockResolvedValue({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      banStatus: null,
      bannedUntil: null,
      banReason: null,
      tokenVersion: 0,
    } as any)

    mockCookies.mockResolvedValue({
      get: jest.fn().mockReturnValue(undefined),
      delete: jest.fn(),
    } as any)
  }

  it('should allow owner role', async () => {
    mockSession({
      id: '1',
      username: 'owner',
      email: 'owner@test.com',
      role: 'owner',
      avatarUrl: null,
    })
    const user = await requireAdmin()
    expect(user.role).toBe('owner')
  })

  it('should allow manager role', async () => {
    mockSession({
      id: '2',
      username: 'manager',
      email: 'manager@test.com',
      role: 'manager',
      avatarUrl: null,
    })
    const user = await requireAdmin()
    expect(user.role).toBe('manager')
  })

  it('should allow admin role', async () => {
    mockSession({
      id: '3',
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      avatarUrl: null,
    })
    const user = await requireAdmin()
    expect(user.role).toBe('admin')
  })

  it('should reject moderator role with 403', async () => {
    mockSession({
      id: '4',
      username: 'moderator',
      email: 'mod@test.com',
      role: 'moderator',
      avatarUrl: null,
    })
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })

  it('should reject publisher role with 403', async () => {
    mockSession({
      id: '5',
      username: 'publisher',
      email: 'pub@test.com',
      role: 'publisher',
      avatarUrl: null,
    })
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })

  it('should reject member role with 403', async () => {
    mockSession({
      id: '6',
      username: 'member',
      email: 'member@test.com',
      role: 'member',
      avatarUrl: null,
    })
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })

  it('should reject unauthenticated user with 401', async () => {
    mockSession(null)
    await expect(requireAdmin()).rejects.toThrow(AuthError)
  })
})
