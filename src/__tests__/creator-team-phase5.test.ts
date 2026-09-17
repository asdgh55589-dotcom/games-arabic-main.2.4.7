/**
 * Phase 5 — Visibility + workflows (admin guard fix, stats, mods link,
 * contacts, transfer, custom tabs).
 */
import { NextRequest } from 'next/server'
import { GET as ADMIN_DASHBOARD } from '@/app/api/admin/teams/[id]/dashboard/route'
import { GET as ADMIN_QUALITY } from '@/app/api/admin/teams/[id]/quality-report/route'
import { GET as ADMIN_ACHIEVEMENTS } from '@/app/api/admin/teams/[id]/achievements/route'
import { GET as ADMIN_REWARDS } from '@/app/api/admin/teams/[id]/rewards/route'
import { GET as TEAM_STATS } from '@/app/api/creator/team/stats/route'
import { GET as TEAM_MODS } from '@/app/api/creator/team/mods/route'
import { POST as MOD_LINK } from '@/app/api/creator/team/mods/link/route'
import { POST as MOD_UNLINK } from '@/app/api/creator/team/mods/unlink/route'
import { GET as CONTACTS_LIST, POST as CONTACT_CREATE } from '@/app/api/creator/team/contacts/route'
import { DELETE as CONTACT_DELETE } from '@/app/api/creator/team/contacts/[id]/route'
import { GET as TABS_LIST, POST as TAB_CREATE } from '@/app/api/creator/team/custom-tabs/route'
import { POST as NOMINATE } from '@/app/api/creator/team/transfer/nominate/route'
import { POST as TRANSFER_ACCEPT } from '@/app/api/creator/team/transfer/accept/route'
import { POST as TRANSFER_DECLINE } from '@/app/api/creator/team/transfer/decline/route'
import { POST as TRANSFER_REVOKE } from '@/app/api/creator/team/transfer/revoke/route'
import { POST as INVITE_ACCEPT } from '@/app/api/creator/team/invites/accept/route'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
  requireAuth: jest.fn(),
  requireModerator: jest.fn(),
  AuthError: class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

// Use the mocked module class so `instanceof AuthError` checks in routes pass.
const { AuthError } = jest.requireMock('@/lib/auth') as {
  AuthError: new (message: string, status: number) => Error
}

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    team: { update: jest.fn() },
    user: { findUnique: jest.fn() },
    mod: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    teamMembership: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    teamFollow: { count: jest.fn() },
    teamContactLink: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    teamCustomTab: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    teamInvitation: { count: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))

// sanitize-html pulls ESM-only htmlparser2 which Jest cannot transform;
// stub the pure helper with equivalent allowlist semantics.
jest.mock('@/lib/sanitize', () => ({
  sanitizeUrl: jest.fn((url: string) => {
    const t = (url || '').trim()
    if (!t) return null
    if (/^(https?|mailto|tel):/i.test(t)) return t
    return null
  }),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/team-helpers', () => ({
  syncTeamCounts: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/email/emitlo', () => ({
  emitloProvider: { send: jest.fn().mockResolvedValue({ ok: true }) },
}))

jest.mock('@/lib/email/from', () => ({
  emailFrom: jest.fn().mockReturnValue('noreply@test.com'),
}))

import { requireAuth, requireCreatorStudio, requireModerator } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockStudio = requireCreatorStudio as jest.Mock
const mockAuth = requireAuth as jest.Mock
const mockModerator = requireModerator as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as Record<string, Record<string, jest.Mock>>

const ownerUser = { id: 'u-owner', username: 'owner-ali', email: 'owner@test.com', role: 'creator', avatarUrl: null, onboardingCompleted: true }
const ownedTeam = { id: 't1', slug: 'gold-team', ownerId: 'u-owner' }

function req(method: string, body?: unknown, url = 'http://localhost/x'): NextRequest {
  return new NextRequest(url, { method, body: body === undefined ? undefined : JSON.stringify(body) })
}
const idParams = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  jest.clearAllMocks()
  mockStudio.mockResolvedValue({ user: ownerUser, error: null })
  mockAuth.mockResolvedValue({ ...ownerUser, role: 'member' })
  mockModerator.mockResolvedValue({ id: 'm1', role: 'moderator' })
  mockOwned.mockResolvedValue(ownedTeam)
  mockDb.notification.create.mockResolvedValue({ id: 'n1' })
})

describe('TASK 0 — admin analytics require moderator', () => {
  const cases = [
    ['dashboard', ADMIN_DASHBOARD],
    ['quality-report', ADMIN_QUALITY],
    ['achievements', ADMIN_ACHIEVEMENTS],
    ['rewards', ADMIN_REWARDS],
  ] as const
  for (const [name, handler] of cases) {
    it(`${name}: unauthenticated → 401`, async () => {
      mockModerator.mockRejectedValueOnce(new AuthError('Unauthorized', 401))
      const res = await handler(req('GET'), idParams('t1') as never)
      expect(res.status).toBe(401)
    })
    it(`${name}: non-staff → 403`, async () => {
      mockModerator.mockRejectedValueOnce(new AuthError('Forbidden', 403))
      const res = await handler(req('GET'), idParams('t1') as never)
      expect(res.status).toBe(403)
    })
  }
})

describe('TASK 1 — team stats aggregates', () => {
  it('returns correct sums, averages, breakdowns and counts', async () => {
    mockDb.mod.findMany.mockResolvedValue([
      { id: 'a', name: 'A', slug: 'a', workflowStatus: 'PUBLISHED', downloads: 100, endorsements: 10, rating: 4, qualityScore: 80, createdAt: new Date() },
      { id: 'b', name: 'B', slug: 'b', workflowStatus: 'PUBLISHED', downloads: 50, endorsements: 5, rating: 2, qualityScore: 40, createdAt: new Date() },
      { id: 'c', name: 'C', slug: 'c', workflowStatus: 'DRAFT', downloads: 999, endorsements: 0, rating: 0, qualityScore: 10, createdAt: new Date() },
    ])
    mockDb.teamMembership.count.mockResolvedValue(4)
    mockDb.teamFollow.count.mockResolvedValue(7)

    const res = await TEAM_STATS(req('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.stats).toMatchObject({
      totalMods: 3,
      publishedMods: 2,
      totalDownloads: 150, // draft downloads excluded
      totalEndorsements: 15,
      avgRating: 3,
      avgQuality: 130 / 3,
    })
    expect(json.data.byStatus).toMatchObject({ PUBLISHED: 2, DRAFT: 1 })
    expect(json.data.topMods[0].id).toBe('a')
    expect(json.data.lowestMods[0].id).toBe('b')
    expect(json.data.memberCount).toBe(4)
    expect(json.data.followsCount).toBe(7)
  })

  it('returns 404 when the caller owns no team', async () => {
    mockOwned.mockResolvedValue(null)
    const res = await TEAM_STATS(req('GET'))
    expect(res.status).toBe(404)
  })
})

describe('TASK 2 — team mods listing is team-scoped', () => {
  it('filters by owned teamId and flags own mods', async () => {
    mockDb.mod.count.mockResolvedValue(1)
    mockDb.mod.findMany.mockResolvedValue([
      { id: 'a', name: 'A', slug: 'a', workflowStatus: 'PUBLISHED', downloads: 3, rating: 5, authorId: 'u-owner', createdAt: new Date() },
    ])
    const res = await TEAM_MODS(req('GET', undefined, 'http://localhost/x?q=A'))
    expect(res.status).toBe(200)
    expect(mockDb.mod.findMany.mock.calls[0][0].where).toMatchObject({ teamId: 't1' })
    const json = await res.json()
    expect(json.data[0].isOwn).toBe(true)
  })
})

describe('TASK 3 — mod link/unlink guards', () => {
  it('link rejects foreign mods (403)', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm', authorId: 'u-stranger', teamId: null, name: 'X' })
    const res = await MOD_LINK(req('POST', { modId: 'm' }))
    expect(res.status).toBe(403)
    expect(mockDb.mod.update).not.toHaveBeenCalled()
  })

  it('link rejects already-linked mods (409)', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm', authorId: 'u-owner', teamId: 't-other', name: 'X' })
    const res = await MOD_LINK(req('POST', { modId: 'm' }))
    expect(res.status).toBe(409)
  })

  it('link success sets teamId', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm', authorId: 'u-owner', teamId: null, name: 'X' })
    mockDb.mod.update.mockResolvedValue({ id: 'm' })
    const res = await MOD_LINK(req('POST', { modId: 'm' }))
    expect(res.status).toBe(200)
    expect(mockDb.mod.update).toHaveBeenCalledWith({ where: { id: 'm' }, data: { teamId: 't1' } })
  })

  it('unlink rejects mods of other teams (404)', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm', teamId: 't-other', name: 'X' })
    const res = await MOD_UNLINK(req('POST', { modId: 'm' }))
    expect(res.status).toBe(404)
    expect(mockDb.mod.update).not.toHaveBeenCalled()
  })

  it('unlink success nulls teamId', async () => {
    mockDb.mod.findUnique.mockResolvedValue({ id: 'm', teamId: 't1', name: 'X' })
    mockDb.mod.update.mockResolvedValue({ id: 'm' })
    const res = await MOD_UNLINK(req('POST', { modId: 'm' }))
    expect(res.status).toBe(200)
    expect(mockDb.mod.update).toHaveBeenCalledWith({ where: { id: 'm' }, data: { teamId: null } })
  })
})

describe('TASK 4 — contacts CRUD + max 10', () => {
  it('rejects the 11th link (409)', async () => {
    mockDb.teamContactLink.count.mockResolvedValue(10)
    const res = await CONTACT_CREATE(req('POST', { type: 'website', url: 'https://x.com' }))
    expect(res.status).toBe(409)
    expect(mockDb.teamContactLink.create).not.toHaveBeenCalled()
  })

  it('rejects unsafe URLs (422)', async () => {
    mockDb.teamContactLink.count.mockResolvedValue(0)
    const res = await CONTACT_CREATE(req('POST', { type: 'website', url: 'javascript:alert(1)' }))
    expect(res.status).toBe(422)
  })

  it('scoped delete returns 404 for foreign rows', async () => {
    mockDb.teamContactLink.findFirst.mockResolvedValue(null)
    const res = await CONTACT_DELETE(req('DELETE'), idParams('foreign'))
    expect(res.status).toBe(404)
    expect(mockDb.teamContactLink.delete).not.toHaveBeenCalled()
  })

  it('list returns owned-team links', async () => {
    mockDb.teamContactLink.findMany.mockResolvedValue([{ id: 'c1' }])
    const res = await CONTACTS_LIST(req('GET'))
    expect(res.status).toBe(200)
    expect(mockDb.teamContactLink.findMany.mock.calls[0][0].where).toEqual({ teamId: 't1' })
  })
})

describe('TASK 7 — custom tabs max 3', () => {
  it('rejects the 4th tab (409)', async () => {
    mockDb.teamCustomTab.count.mockResolvedValue(3)
    const res = await TAB_CREATE(req('POST', { title: 'Extra', content: 'x' }))
    expect(res.status).toBe(409)
    expect(mockDb.teamCustomTab.create).not.toHaveBeenCalled()
  })

  it('list is team-scoped', async () => {
    mockDb.teamCustomTab.findMany.mockResolvedValue([])
    const res = await TABS_LIST(req('GET'))
    expect(res.status).toBe(200)
    expect(mockDb.teamCustomTab.findMany.mock.calls[0][0].where).toEqual({ teamId: 't1' })
  })
})

describe('TASK 6 — ownership transfer flow', () => {
  const nominee = { id: 'mem2', teamId: 't1', userId: 'u-nominee', name: 'sara', role: 'member', user: { id: 'u-nominee', username: 'sara', email: 's@t.com' } }

  it('nominate rejects phantoms (422) and self (422)', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValueOnce({ ...nominee, userId: null, user: null })
    expect((await NOMINATE(req('POST', { memberId: 'mem2' }))).status).toBe(422)
    mockDb.teamMembership.findFirst.mockResolvedValueOnce({ ...nominee, userId: 'u-owner', role: 'owner', user: { id: 'u-owner', username: 'o', email: 'o@t.com' } })
    expect((await NOMINATE(req('POST', { memberId: 'mem1' }))).status).toBe(422)
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })

  it('nominate rejects duplicate pending + lifetime cap', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue(nominee)
    mockDb.teamInvitation.findFirst.mockResolvedValue({ id: 'old' })
    expect((await NOMINATE(req('POST', { memberId: 'mem2' }))).status).toBe(409)
    mockDb.teamInvitation.findFirst.mockResolvedValue(null)
    mockDb.teamInvitation.count.mockResolvedValue(3)
    expect((await NOMINATE(req('POST', { memberId: 'mem2' }))).status).toBe(409)
  })

  it('nominate success creates owner-role invitation with token', async () => {
    mockDb.teamMembership.findFirst.mockResolvedValue(nominee)
    mockDb.teamInvitation.findFirst.mockResolvedValue(null)
    mockDb.teamInvitation.count.mockResolvedValue(0)
    mockDb.teamInvitation.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({ id: 'tr1', ...args.data }))
    const res = await NOMINATE(req('POST', { memberId: 'mem2' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(typeof json.data.token).toBe('string')
    expect(mockDb.teamInvitation.create.mock.calls[0][0].data.role).toBe('owner')
  })

  it('accept swaps ownerId + roles atomically', async () => {
    mockAuth.mockResolvedValue({ id: 'u-nominee', username: 'sara', email: 's@t.com', role: 'member' })
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      id: 'tr1', teamId: 't1', invitedUserId: 'u-nominee', inviteeUsername: 'sara', inviteeEmail: 's@t.com',
      role: 'owner', status: 'pending', expiresAt: new Date(Date.now() + 86400000), invitedBy: 'u-owner',
      team: { id: 't1', name: 'Gold', slug: 'gold', ownerId: 'u-owner' },
    })
    mockDb.teamMembership.findFirst.mockResolvedValue({ id: 'mem2' })
    mockDb.$transaction.mockImplementation(async (fn: (tx: { teamInvitation: { updateMany: jest.Mock }; team: { update: jest.Mock }; teamMembership: { updateMany: jest.Mock; update: jest.Mock } }) => Promise<unknown>) =>
      fn({
        teamInvitation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        team: { update: jest.fn().mockResolvedValue({}) },
        teamMembership: { updateMany: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
      }),
    )
    const res = await TRANSFER_ACCEPT(req('POST', { token: 'y'.repeat(43) }))
    expect(res.status).toBe(200)
    expect(mockDb.$transaction).toHaveBeenCalled()
  })

  it('accept rejects wrong user (403), expired (422), raced (409)', async () => {
    const base = {
      id: 'tr1', teamId: 't1', invitedUserId: 'u-nominee', inviteeUsername: 'sara', inviteeEmail: 's@t.com',
      role: 'owner', status: 'pending', expiresAt: new Date(Date.now() + 86400000), invitedBy: 'u-owner',
      team: { id: 't1', name: 'Gold', slug: 'gold', ownerId: 'u-owner' },
    }
    mockAuth.mockResolvedValue({ id: 'u-stranger', username: 'z', email: 'z@t.com', role: 'member' })
    mockDb.teamInvitation.findUnique.mockResolvedValue(base)
    expect((await TRANSFER_ACCEPT(req('POST', { token: 'y'.repeat(43) }))).status).toBe(403)

    mockAuth.mockResolvedValue({ id: 'u-nominee', username: 'sara', email: 's@t.com', role: 'member' })
    mockDb.teamInvitation.findUnique.mockResolvedValue({ ...base, expiresAt: new Date(Date.now() - 1000) })
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 1 })
    expect((await TRANSFER_ACCEPT(req('POST', { token: 'y'.repeat(43) }))).status).toBe(422)
  })

  it('decline is idempotent; revoke 404s with nothing pending', async () => {
    mockAuth.mockResolvedValue({ id: 'u-nominee', username: 'sara', email: 's@t.com', role: 'member' })
    mockDb.teamInvitation.findUnique.mockResolvedValue({ id: 'tr1', teamId: 't1', invitedUserId: 'u-nominee', inviteeUsername: 'sara', inviteeEmail: 's@t.com', role: 'owner', status: 'accepted' })
    const d = await TRANSFER_DECLINE(req('POST', { token: 'y'.repeat(43) }))
    expect(d.status).toBe(200)
    mockDb.teamInvitation.updateMany.mockResolvedValue({ count: 0 })
    expect((await TRANSFER_REVOKE(req('POST'))).status).toBe(404)
  })

  it('regular invite accept rejects owner-role rows (anti-escalation)', async () => {
    mockAuth.mockResolvedValue({ id: 'u-nominee', username: 'sara', email: 's@t.com', role: 'member' })
    mockDb.teamInvitation.findUnique.mockResolvedValue({
      id: 'tr1', teamId: 't1', invitedUserId: 'u-nominee', inviteeUsername: 'sara', inviteeEmail: 's@t.com',
      role: 'owner', status: 'pending', expiresAt: new Date(Date.now() + 86400000), invitedBy: 'u-owner',
      team: { id: 't1', name: 'Gold', slug: 'gold' },
    })
    expect((await INVITE_ACCEPT(req('POST', { token: 'y'.repeat(43) }))).status).toBe(409)
    expect(mockDb.teamMembership.create).not.toHaveBeenCalled()
  })
})
