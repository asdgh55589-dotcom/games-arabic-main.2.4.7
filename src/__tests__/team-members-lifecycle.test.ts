/**
 * Team member lifecycle — owner sync, removal semantics, invite acceptance cap.
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  AuthError: class extends Error {
    status: number
    constructor(status = 401) { super(); this.status = status }
  },
}))
jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  db: {
    team: { findUnique: jest.fn() },
    teamInvitation: { updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    teamMembership: {
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    teamFollow: { count: jest.fn() },
    $transaction: jest.fn(),
    mod: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  },
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/email', () => ({
  emailProvider: { send: jest.fn().mockResolvedValue({}) },
}))
jest.mock('@/lib/email/from', () => ({ emailFrom: () => 'noreply@test.com' }))
jest.mock('@/lib/email/templates', () => ({
  buildInviteEmail: () => ({ subject: 's', html: '<p>s</p>' }),
}))

import { POST as transferAccept } from '@/app/api/creator/team/transfer/accept/route'
import { POST as inviteAccept } from '@/app/api/creator/team/invites/accept/route'
import { db } from '@/lib/db'

const mockDb = db as any
const mockRequireAuth = requireAuth as jest.Mock

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ id: 'u-new', username: 'new', email: 'n@test.com' })
  mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })
  mockDb.teamMembership.create.mockResolvedValue({ id: 'm-new' })
  mockDb.teamMembership.update.mockResolvedValue({ id: 'm1' })
  mockDb.teamMembership.count.mockResolvedValue(0)
  mockDb.team.findUnique.mockResolvedValue({ id: 't1', ownerId: 'u-old', name: 'T' })
})

describe('ownership transfer — role sync', () => {
  it('transfers owner role and demotes previous owner to member in one transaction', async () => {
    let txTeamUpdate: any, txMembershipUpdate: any, txMembershipUpdateMany: any
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      id: 'inv1',
      role: 'owner',
      status: 'pending',
      expiresAt: new Date(Date.now() + 1e6),
      invitedUserId: 'u-new',
      team: { id: 't1', name: 'T', slug: 't', ownerId: 'u-old' },
    })
    mockDb.teamMembership.findFirst.mockResolvedValue({ id: 'm-new', teamId: 't1', userId: 'u-new' })
    mockDb.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        teamInvitation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        team: { update: jest.fn().mockResolvedValue({}) },
        teamMembership: {
          updateMany: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
        },
      }
      txTeamUpdate = tx.team.update
      txMembershipUpdate = tx.teamMembership.update
      txMembershipUpdateMany = tx.teamMembership.updateMany
      return fn(tx)
    })

    const res = await transferAccept(jsonReq({ token: 'valid-token-12345678901234567890' }))

    expect(res.status).toBe(200)
    expect(txMembershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'owner' } }),
    )
    expect(txMembershipUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { role: 'member' } }),
    )
    expect(txTeamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ownerId: 'u-new' } }),
    )
  })
})

describe('invite acceptance — member cap', () => {
  it('rejects acceptance when team already has 50 active members', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      id: 'inv1',
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 1e6),
      invitedUserId: 'u-new',
      team: { id: 't1', name: 'T', slug: 't' },
    })
    mockDb.teamMembership.count.mockResolvedValue(50)

    const res = await inviteAccept(jsonReq({ token: 'valid-token-12345678901234567890' }))

    expect(res.status).toBe(409)
    expect(mockDb.teamMembership.create).not.toHaveBeenCalled()
  })
})
