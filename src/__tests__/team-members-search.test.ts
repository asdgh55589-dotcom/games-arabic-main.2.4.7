/**
 * Creator team members — search / filter / status pagination.
 */
import { NextRequest } from 'next/server'
import { GET as listMembers } from '@/app/api/creator/team/members/route'

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
      findUnique: jest.fn().mockResolvedValue({ role: 'owner', status: 'active' }),
    },
  },
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockAuth = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as any

function req(url: string): NextRequest {
  return new NextRequest(url)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u-creator', username: 'ali' }, error: null })
  mockOwned.mockResolvedValue({ id: 't1', ownerId: 'u-creator' })
  mockDb.teamMembership.count.mockResolvedValue(2)
  mockDb.teamMembership.findMany.mockResolvedValue([
    { id: 'm1', userId: 'u-1', name: 'Ali', role: 'admin', status: 'active', joinedAt: new Date(), user: null, avatarUrl: null, ghostName: null, ghostEmail: null, ghostAvatarUrl: null, ghostBio: null, bio: null },
    { id: 'm2', userId: null, name: 'Guest', role: 'translator', status: 'active', joinedAt: new Date(), user: null, avatarUrl: null, ghostName: null, ghostEmail: null, ghostAvatarUrl: null, ghostBio: null, bio: null },
  ])
})

describe('members search/filter', () => {
  it('applies search, role and status filters to the query', async () => {
    mockDb.teamMembership.findMany.mockResolvedValueOnce([])

    await listMembers(req('http://localhost/x?search=ali&role=admin&status=active'))

    expect(mockDb.teamMembership.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 't1',
          status: 'active',
          role: 'admin',
          OR: expect.arrayContaining([
            expect.objectContaining({ name: { contains: 'ali', mode: 'insensitive' } }),
          ]),
        }),
      }),
    )
    expect(mockDb.teamMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          teamId: 't1',
          status: 'active',
          role: 'admin',
        }),
      }),
    )
  })

  it('filters by status when provided', async () => {
    mockDb.teamMembership.findMany.mockResolvedValueOnce([])
    await listMembers(req('http://localhost/x?status=active'))
    expect(mockDb.teamMembership.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'active' }) }),
    )
  })

  it('does not filter by status when omitted', async () => {
    mockDb.teamMembership.findMany.mockResolvedValueOnce([])
    await listMembers(req('http://localhost/x'))
    expect(mockDb.teamMembership.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ status: 'active' }) }),
    )
  })
})
