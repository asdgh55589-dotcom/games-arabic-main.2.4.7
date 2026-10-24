/**
 * Bulk invites — created / skipped results, self-invite skipped, cap respected.
 */
import { NextRequest } from 'next/server'
import { POST as bulkInvite } from '@/app/api/creator/team/invites/bulk/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  db: {
    teamMembership: { count: jest.fn(), findFirst: jest.fn() },
    teamInvitation: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/email', () => ({
  emailProvider: { send: jest.fn().mockResolvedValue({}) },
}))
jest.mock('@/lib/email/from', () => ({ emailFrom: () => 'noreply@test.com' }))
jest.mock('@/lib/email/templates', () => ({
  buildInviteEmail: () => ({ subject: 's', html: '<p>s</p>' }),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockAuth = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as any

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u-creator', username: 'ali' }, error: null })
  mockOwned.mockResolvedValue({ id: 't1', ownerId: 'u-creator' })
  mockDb.teamMembership.count.mockResolvedValue(0)
  mockDb.teamInvitation.count.mockResolvedValue(0)
  mockDb.teamMembership.findFirst.mockResolvedValue(null)
  mockDb.teamInvitation.findFirst.mockResolvedValue(null)
  mockDb.user.findUnique.mockResolvedValue(null)
  mockDb.teamInvitation.create.mockResolvedValue({ id: 'inv-1' })
})

describe('bulk invites', () => {
  it('creates invites for new users and returns per-item results', async () => {
    mockDb.user.findUnique.mockResolvedValueOnce({ id: 'u-bob', username: 'bob', email: 'bob@test.com' })

    const res = await bulkInvite(jsonReq({
      invites: [{ email: 'bob@test.com', role: 'translator' }],
    }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.created).toBe(1)
    expect(json.data.results[0].status).toBe('created')
    expect(mockDb.teamInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ inviteeEmail: 'bob@test.com', role: 'translator' }),
      }),
    )
  })

  it('skips a self-invite', async () => {
    mockDb.user.findUnique.mockResolvedValue({
      id: 'u-creator',
      username: 'ali',
      email: 'ali@test.com',
    })
    const res = await bulkInvite(jsonReq({
      invites: [{ email: 'ali@test.com', role: 'member' }],
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.data.results[0].status).toBe('skipped')
    expect(json.data.results[0].reason).toBe('لا يمكنك دعوة نفسك')
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })

  it('respects the member cap', async () => {
    mockDb.teamMembership.count.mockResolvedValue(50)
    const res = await bulkInvite(jsonReq({ invites: [{ email: 'bob@test.com' }] }))
    expect(res.status).toBe(409)
  })
})
