/**
 * Phase 1 — Creator Team Management (T1-T6).
 * Covers: create success, second-team rejection, non-creator blocked,
 * update success, slug-edit rejection, member listing scoped to owned team.
 */
import { NextRequest } from 'next/server'
import { GET as GET_TEAM, PATCH as PATCH_TEAM, POST as POST_TEAM } from '@/app/api/creator/team/route'
import { GET as GET_MEMBERS } from '@/app/api/creator/team/members/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    team: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    teamMembership: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    teamFollow: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/permissions', () => ({
  can: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/utils', () => ({
  slugify: jest.fn().mockImplementation((s: string) => s.toLowerCase().trim().replace(/\s+/g, '-')),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockAuth = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as {
  team: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock }
  teamMembership: { count: jest.Mock; findMany: jest.Mock; create: jest.Mock }
  teamFollow: { count: jest.Mock }
  $transaction: jest.Mock
}

const creatorUser = {
  id: 'u-creator',
  username: 'ali',
  email: 'ali@test.com',
  role: 'creator',
  avatarUrl: null,
  onboardingCompleted: true,
}

function req(method: string, body?: unknown, url = 'http://localhost/x'): NextRequest {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: creatorUser, error: null })
})

describe('T1 — create team success', () => {
  it('creates team + owner membership and returns 201', async () => {
    mockOwned.mockResolvedValue(null)
    mockDb.team.findUnique.mockResolvedValue(null)
    const created = { id: 't1', slug: 'gold-team', name: 'Gold Team', ownerId: 'u-creator' }
    mockDb.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        team: { create: jest.fn().mockResolvedValue(created) },
        teamMembership: { create: jest.fn().mockResolvedValue({ id: 'm1' }) },
      }),
    )

    const res = await POST_TEAM(req('POST', { name: 'Gold Team' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.team.slug).toBe('gold-team')
    expect(mockDb.$transaction).toHaveBeenCalled()
  })
})

describe('T2 — second team rejection', () => {
  it('returns 409 when creator already owns a team', async () => {
    mockOwned.mockResolvedValue({ id: 't0', slug: 'old', ownerId: 'u-creator' })

    const res = await POST_TEAM(req('POST', { name: 'Another Team' }))
    expect(res.status).toBe(409)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })
})

describe('T3 — non-creator blocked', () => {
  it('passes through the studio guard error', async () => {
    const guardError = new Response(JSON.stringify({ error: 'x' }), { status: 403 })
    mockAuth.mockResolvedValue({ user: null, error: guardError })

    const res = await POST_TEAM(req('POST', { name: 'Gold Team' }))
    expect(res).toBe(guardError)
  })
})

describe('T4 — update team success', () => {
  it('updates allowlisted fields on the owned team', async () => {
    mockOwned.mockResolvedValue({ id: 't1', slug: 'gold-team', ownerId: 'u-creator' })
    mockDb.team.update.mockResolvedValue({ id: 't1', name: 'New Name' })

    const res = await PATCH_TEAM(req('PATCH', { name: 'New Name', description: 'desc' }))
    expect(res.status).toBe(200)
    expect(mockDb.team.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ name: 'New Name' }),
    })
  })
})

describe('T5 — slug edit rejection', () => {
  it('rejects unknown slug field via strict schema', async () => {
    mockOwned.mockResolvedValue({ id: 't1', slug: 'gold-team', ownerId: 'u-creator' })

    const res = await PATCH_TEAM(req('PATCH', { slug: 'hacked', name: 'New Name' }))
    expect(res.status).toBe(422)
    expect(mockDb.team.update).not.toHaveBeenCalled()
  })
})

describe('T6 — member listing scoped', () => {
  it('lists only owned-team members', async () => {
    mockOwned.mockResolvedValue({ id: 't1', slug: 'gold-team', ownerId: 'u-creator' })
    mockDb.teamMembership.count.mockResolvedValue(2)
    mockDb.teamMembership.findMany.mockResolvedValue([
      {
        id: 'm1',
        userId: 'u-creator',
        name: 'ali',
        avatarUrl: null,
        role: 'owner',
        joinedAt: new Date('2026-01-01'),
        user: { id: 'u-creator', username: 'ali', displayName: null, avatarUrl: null },
      },
    ])

    const res = await GET_MEMBERS(req('GET', undefined, 'http://localhost/x?page=1&limit=24'))
    expect(res.status).toBe(200)
    expect(mockDb.teamMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teamId: 't1' } }),
    )
    const json = await res.json()
    expect(json.data).toHaveLength(1)
  })

  it('returns 404 when caller owns no team', async () => {
    mockOwned.mockResolvedValue(null)

    const res = await GET_TEAM(req('GET'))
    expect(res.status).toBe(404)
  })
})
