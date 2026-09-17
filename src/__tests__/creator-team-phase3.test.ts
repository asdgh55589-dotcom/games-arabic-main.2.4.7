/**
 * Phase 3 — Creator team invitations (T14-T28).
 * Invite create/list/revoke + accept/decline with expiry, binding, and race guards.
 */
import { NextRequest } from 'next/server'
import { GET as LIST_INVITES, POST as CREATE_INVITE } from '@/app/api/creator/team/invites/route'
import { POST as REVOKE_INVITE } from '@/app/api/creator/team/invites/[id]/revoke/route'
import { GET as INVITE_META } from '@/app/api/creator/team/invites/[id]/route'
import { POST as ACCEPT_INVITE } from '@/app/api/creator/team/invites/accept/route'
import { POST as DECLINE_INVITE } from '@/app/api/creator/team/invites/decline/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
  requireAuth: jest.fn(),
  AuthError: class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: jest.fn() },
    teamMembership: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    teamInvitation: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: { create: jest.fn() },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/email/emitlo', () => ({
  emitloProvider: { send: jest.fn().mockResolvedValue({ ok: true }) },
}))

jest.mock('@/lib/email/from', () => ({
  emailFrom: jest.fn().mockReturnValue('noreply@test.com'),
}))

import { requireAuth, requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { hashInviteToken } from '@/lib/team-invites'

const mockStudio = requireCreatorStudio as jest.Mock
const mockAuth = requireAuth as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as {
  user: { findUnique: jest.Mock }
  teamMembership: { count: jest.Mock; findFirst: jest.Mock; create: jest.Mock }
  teamInvitation: {
    count: jest.Mock
    findMany: jest.Mock
    findFirst: jest.Mock
    findUnique: jest.Mock
    create: jest.Mock
    updateMany: jest.Mock
  }
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
const memberUser = {
  id: 'u-member',
  username: 'sara',
  email: 'sara@test.com',
  role: 'member',
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
const idParams = (id: string) => ({ params: Promise.resolve({ id }) })
const tokenParams = (token: string) => ({ params: Promise.resolve({ id: token }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockStudio.mockResolvedValue({ user: ownerUser, error: null })
  mockAuth.mockResolvedValue(memberUser)
  mockOwned.mockResolvedValue(ownedTeam)
  mockDb.notification.create.mockResolvedValue({ id: 'n1' })
})

describe('T14 — create invitation success (username)', () => {
  it('returns 201 with a one-time token that differs from the stored hash', async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: 'u-member', username: 'sara', email: 'sara@test.com' })
    mockDb.teamMembership.findFirst.mockResolvedValue(null)
    mockDb.teamMembership.count.mockResolvedValue(2)
    mockDb.teamInvitation.findFirst.mockResolvedValue(null)
    mockDb.teamInvitation.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'inv1',
      ...args.data,
      createdAt: new Date(),
      respondedAt: null,
    }))

    const res = await CREATE_INVITE(req('POST', { username: 'sara', role: 'translator' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(typeof json.data.token).toBe('string')
    expect(json.data.token.length).toBeGreaterThan(20)
    const storedHash = mockDb.teamInvitation.create.mock.calls[0][0].data.tokenHash
    expect(storedHash).not.toBe(json.data.token)
    expect(storedHash).toBe(hashInviteToken(json.data.token))
    expect(json.data.invite.tokenHash).toBeUndefined()
  })
})

describe('T15 — email-only invitation', () => {
  it('creates an invite with null invitedUserId for unknown emails', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.teamMembership.count.mockResolvedValue(1)
    mockDb.teamInvitation.findFirst.mockResolvedValue(null)
    mockDb.teamInvitation.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      id: 'inv2',
      ...args.data,
      createdAt: new Date(),
      respondedAt: null,
    }))

    const res = await CREATE_INVITE(req('POST', { email: 'new@test.com', role: 'member' }))
    expect(res.status).toBe(201)
    expect(mockDb.teamInvitation.create.mock.calls[0][0].data.invitedUserId).toBeNull()
  })
})

describe('duplicate + member guards', () => {
  it('rejects inviting an existing member (409)', async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: 'u-member', username: 'sara', email: 'sara@test.com' })
    mockDb.teamMembership.findFirst.mockResolvedValue({ id: 'm2' })

    const res = await CREATE_INVITE(req('POST', { username: 'sara' }))
    expect(res.status).toBe(409)
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })

  it('rejects duplicate pending invites (409)', async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: 'u-member', username: 'sara', email: 'sara@test.com' })
    mockDb.teamMembership.findFirst.mockResolvedValue(null)
    mockDb.teamMembership.count.mockResolvedValue(2)
    mockDb.teamInvitation.findFirst.mockResolvedValue({ id: 'inv-old' })

    const res = await CREATE_INVITE(req('POST', { username: 'sara' }))
    expect(res.status).toBe(409)
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })

  it('rejects owner role in invites (422)', async () => {
    const res = await CREATE_INVITE(req('POST', { username: 'sara', role: 'owner' }))
    expect(res.status).toBe(422)
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })

  it('rejects unknown usernames (404)', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)
    const res = await CREATE_INVITE(req('POST', { username: 'ghost' }))
    expect(res.status).toBe(404)
  })
})

describe('revocation', () => {
  it('revokes a pending invite atomically', async () => {
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })
    const res = await REVOKE_INVITE(req('POST'), idParams('inv1'))
    expect(res.status).toBe(200)
    expect(mockDb.teamInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv1', teamId: 't1', status: 'pending' } }),
    )
  })

  it('returns 404 when nothing was pending', async () => {
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 0 })
    const res = await REVOKE_INVITE(req('POST'), idParams('inv1'))
    expect(res.status).toBe(404)
  })
})

describe('acceptance', () => {
  const pendingInvite = {
    id: 'inv1',
    teamId: 't1',
    invitedUserId: 'u-member',
    inviteeUsername: 'sara',
    inviteeEmail: 'sara@test.com',
    role: 'translator',
    status: 'pending',
    expiresAt: new Date(Date.now() + 86400000),
    invitedBy: 'u-owner',
    team: { id: 't1', name: 'Gold Team', slug: 'gold-team' },
  }

  it('accept success creates a linked membership', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue(pendingInvite)
    mockDb.teamMembership.findFirst.mockResolvedValue(null)
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })
    mockDb.teamMembership.create.mockResolvedValue({ id: 'm9' })

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(200)
    expect(mockDb.teamMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: 't1', userId: 'u-member', role: 'translator' }),
      }),
    )
  })

  it('expired invite is flipped to expired and rejected', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      ...pendingInvite,
      expiresAt: new Date(Date.now() - 1000),
    })
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(422)
    expect(mockDb.teamMembership.create).not.toHaveBeenCalled()
    expect(mockDb.teamInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'expired' }) }),
    )
  })

  it('revoked invite cannot be accepted', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue({ ...pendingInvite, status: 'revoked' })

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(409)
    expect(mockDb.teamMembership.create).not.toHaveBeenCalled()
  })

  it('wrong user is rejected by binding check (403)', async () => {
    mockAuth.mockResolvedValue({ ...memberUser, id: 'u-stranger', username: 'stranger', email: 'x@test.com' })
    mockDb.teamInvitation.findUnique.mockResolvedValue(pendingInvite)

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(403)
    expect(mockDb.teamMembership.create).not.toHaveBeenCalled()
  })

  it('duplicate membership is reported without double-join', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue(pendingInvite)
    mockDb.teamMembership.findFirst.mockResolvedValue({ id: 'm-existing' })
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(409)
  })
})

describe('decline', () => {
  it('decline success marks the invite declined', async () => {
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      id: 'inv1',
      teamId: 't1',
      invitedUserId: 'u-member',
      inviteeUsername: 'sara',
      inviteeEmail: 'sara@test.com',
      status: 'pending',
    })
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })

    const res = await DECLINE_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(200)
    expect(mockDb.teamInvitation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'declined' }) }),
    )
  })
})

describe('auth guards', () => {
  it('unauthenticated accept returns 401', async () => {
    const { AuthError } = jest.requireMock('@/lib/auth') as { AuthError: new (m: string, s: number) => Error }
    mockAuth.mockRejectedValue(new AuthError('Unauthorized', 401))

    const res = await ACCEPT_INVITE(req('POST', { token: 'x'.repeat(43) }))
    expect(res.status).toBe(401)
  })

  it('non-owner cannot list invites (404, no owned team)', async () => {
    mockOwned.mockResolvedValue(null)
    const res = await LIST_INVITES(req('GET', undefined, 'http://localhost/x?status=pending'))
    expect(res.status).toBe(404)
  })

  it('invite metadata requires auth', async () => {
    const { AuthError } = jest.requireMock('@/lib/auth') as { AuthError: new (m: string, s: number) => Error }
    mockAuth.mockRejectedValue(new AuthError('Unauthorized', 401))
    const res = await INVITE_META(req('GET'), tokenParams('x'.repeat(43)))
    expect(res.status).toBe(401)
  })
})
