jest.mock('@/lib/db', () => ({
  db: {
    team: { findUnique: jest.fn(), findFirst: jest.fn() },
    teamFollow: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    teamMembership: { findFirst: jest.fn(), update: jest.fn() },
  },
}))
jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
  requireAuth: jest.fn(),
  AuthError: class AuthError extends Error {},
}))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))

import { POST as followPOST } from '@/app/api/teams/[slug]/follow/route'
import { POST as leavePOST } from '@/app/api/teams/[slug]/leave/route'
import { getOptionalSession, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const dbm = db as any
const params = { params: Promise.resolve({ slug: 'old-team' }) }
const req = { json: async () => ({}) } as any

beforeEach(() => {
  jest.clearAllMocks()
  ;(getOptionalSession as jest.Mock).mockResolvedValue({ id: 'u1' })
  ;(requireAuth as jest.Mock).mockResolvedValue({ id: 'u1', username: 'ali' })
})

describe('archived teams reject follow/leave', () => {
  it('follow POST filters archivedAt at the slug lookup', async () => {
    dbm.team.findUnique.mockResolvedValue(null)

    const res = await followPOST(req, params)

    expect(res.status).toBe(404)
    expect(dbm.team.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'old-team', archivedAt: null } }),
    )
    expect(dbm.teamFollow.create).not.toHaveBeenCalled()
  })

  it('leave filters archivedAt for both id and slug lookups', async () => {
    dbm.team.findFirst.mockResolvedValue(null)

    const res = await leavePOST(req, params)

    expect(res.status).toBe(404)
    expect(dbm.team.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'old-team', archivedAt: null } }),
    )
    expect(dbm.team.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { slug: 'old-team', archivedAt: null } }),
    )
    expect(dbm.teamMembership.update).not.toHaveBeenCalled()
  })
})
