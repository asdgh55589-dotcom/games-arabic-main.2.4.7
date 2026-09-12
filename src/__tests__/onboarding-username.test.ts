/**
 * Tests for GET /api/auth/onboarding/check-username (D.6-b1).
 * Real-time availability + suggestion for the onboarding username step.
 */

const mockRequireAuth = jest.fn()
const mockFindUnique = jest.fn()

jest.mock('@/lib/auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

jest.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) } },
}))

import { GET } from '@/app/api/auth/onboarding/check-username/route'

function req(username: string | null) {
  const url =
    username === null
      ? 'http://x/api/auth/onboarding/check-username'
      : `http://x/api/auth/onboarding/check-username?username=${encodeURIComponent(username)}`
  return { url } as never
}

describe('check-username', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ id: 'u1', role: 'member', username: 'old_name' })
  })

  it('returns available:true when the username is free', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(req('new_user-9'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { available: true, username: 'new_user-9' } })
  })

  it('returns available:false with a suggestion when taken', async () => {
    mockFindUnique.mockImplementation(async (args: { where: { username: string } }) => {
      if (args.where.username === 'taken') return { id: 'other' }
      return null
    })
    const res = await GET(req('taken'))
    expect(res.status).toBe(200)
    const body = (await res.json()).data
    expect(body.available).toBe(false)
    expect(typeof body.suggestion).toBe('string')
    expect(body.suggestion).not.toBe('taken')
  })

  it('rejects invalid usernames without hitting the DB', async () => {
    for (const bad of ['ab', 'has space', 'عربي', 'a'.repeat(31)]) {
      const res = await GET(req(bad))
      expect(res.status).toBe(422)
    }
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('requires a username param', async () => {
    const res = await GET(req(null))
    expect(res.status).toBe(422)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))
    mockFindUnique.mockResolvedValue(null)
    const res = await GET(req('someone'))
    expect(res.status).toBe(401)
  })
})
