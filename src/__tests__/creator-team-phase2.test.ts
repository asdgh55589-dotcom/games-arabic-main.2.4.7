/**
 * Phase 2 — Creator team member management (T7-T13).
 * PATCH: role change. DELETE: phantom-preserving removal.
 */
import { NextRequest } from 'next/server'
import { DELETE, GET, PATCH } from '@/app/api/creator/team/members/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    teamMembership: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
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
  teamMembership: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock }
  notification: { create: jest.Mock }
}

const ownerUser = {
  id: 'u-owner',
  username: 'owner-ali',
  email: 'owner@test.com',
  role: 'creator',
  avatarUrl: null,
  onboardingCompleted: true,
}

const ownedTeam = { id: 't1', slug: 'gold-team', ownerId: 'u-owner' }

function req(method: string, body?: unknown, url = 'http://localhost/x'): NextRequest {
  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: ownerUser, error: null })
  mockOwned.mockResolvedValue(ownedTeam)
})

describe('T11 — role update success', () => {
  it('updates a linked member to translator', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm2',
      teamId: 't1',
      userId: 'u-member',
      name: 'sara',
      role: 'member',
    })
    mockDb.teamMembership.update.mockResolvedValue({ id: 'm2', role: 'translator' })
    mockDb.notification.create.mockResolvedValue({ id: 'n1' })

    const res = await PATCH(req('PATCH', { memberId: 'm2', role: 'translator' }))
    expect(res.status).toBe(200)
    expect(mockDb.teamMembership.update).toHaveBeenCalledWith({
      where: { id: 'm2' },
      data: { role: 'translator' },
    })
  })
})

describe('T12 — role owner rejected', () => {
  it('returns 422 and never writes', async () => {
    const res = await PATCH(req('PATCH', { memberId: 'm2', role: 'owner' }))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })

  it('rejects unknown roles', async () => {
    const res = await PATCH(req('PATCH', { memberId: 'm2', role: 'superadmin' }))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })
})

describe('T7 — member removal success', () => {
  it('preserves phantom (userId -> null) instead of deleting', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm2',
      teamId: 't1',
      userId: 'u-member',
      name: 'sara',
      role: 'member',
    })
    mockDb.teamMembership.update.mockResolvedValue({ id: 'm2', userId: null })
    mockDb.notification.create.mockResolvedValue({ id: 'n1' })

    const res = await DELETE(req('DELETE', undefined, 'http://localhost/x?memberId=m2'))
    expect(res.status).toBe(200)
    expect(mockDb.teamMembership.update).toHaveBeenCalledWith({
      where: { id: 'm2' },
      data: { userId: null },
    })
  })
})

describe('T8 — self-removal blocked', () => {
  it('owner cannot remove their own membership', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      userId: 'u-owner',
      name: 'owner-ali',
      role: 'owner',
    })

    const res = await DELETE(req('DELETE', undefined, 'http://localhost/x?memberId=m1'))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })

  it('owner cannot change their own role via PATCH', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      userId: 'u-owner',
      name: 'owner-ali',
      role: 'owner',
    })

    const res = await PATCH(req('PATCH', { memberId: 'm1', role: 'member' }))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })
})

describe('T9 — owner-role removal blocked', () => {
  it('cannot remove the owner-role row', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm1',
      teamId: 't1',
      userId: 'u-owner',
      name: 'owner-ali',
      role: 'owner',
    })

    const res = await DELETE(req('DELETE', undefined, 'http://localhost/x?memberId=m1'))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })
})

describe('T10 — foreign member 404', () => {
  it('DELETE on another team member returns 404 with no write', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue(null)

    const res = await DELETE(req('DELETE', undefined, 'http://localhost/x?memberId=foreign'))
    expect(res.status).toBe(404)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })

  it('PATCH on another team member returns 404 with no write', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue(null)

    const res = await PATCH(req('PATCH', { memberId: 'foreign', role: 'member' }))
    expect(res.status).toBe(404)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })
})

describe('T13 — non-owner blocked', () => {
  it('caller with no owned team gets 404 on PATCH', async () => {
    mockOwned.mockResolvedValue(null)

    const res = await PATCH(req('PATCH', { memberId: 'm2', role: 'member' }))
    expect(res.status).toBe(404)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })

  it('caller with no owned team gets 404 on DELETE', async () => {
    mockOwned.mockResolvedValue(null)

    const res = await DELETE(req('DELETE', undefined, 'http://localhost/x?memberId=m2'))
    expect(res.status).toBe(404)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })

  it('phantom member role change is rejected', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue({
      id: 'm9',
      teamId: 't1',
      userId: null,
      name: 'legacy-credit',
      role: 'member',
    })

    const res = await PATCH(req('PATCH', { memberId: 'm9', role: 'translator' }))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.update).not.toHaveBeenCalled()
  })
})

describe('member listing still scoped (regression)', () => {
  it('GET lists owned-team members', async () => {
    mockDb.teamMembership.count.mockResolvedValue(1)
    mockDb.teamMembership.findMany.mockResolvedValue([
      {
        id: 'm1',
        userId: 'u-owner',
        name: 'owner-ali',
        avatarUrl: null,
        role: 'owner',
        joinedAt: new Date('2026-01-01'),
        user: { id: 'u-owner', username: 'owner-ali', displayName: null, avatarUrl: null },
      },
    ])

    const res = await GET(req('GET', undefined, 'http://localhost/x?page=1&limit=24'))
    expect(res.status).toBe(200)
  })
})
