/**
 * Team permission matrix — integration tests.
 *
 * Verifies every mutating/reading route enforces the matrix in
 * src/lib/team-permissions.ts:
 * - owner can do everything
 * - admin can edit members/invite/contacts but NOT transfer ownership
 * - moderator can invite/manage contacts/tabs but NOT change role/remove/transfer
 * - translator/member/tester can only view (view_dashboard/view_stats)
 * - unauthorized action returns 403 (never 200)
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))
jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))
jest.mock('@/lib/db', () => ({
  db: {
    team: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    teamMembership: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    teamInvitation: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    teamContactLink: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamCustomTab: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamFollow: { count: jest.fn() },
    mod: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}))
jest.mock('@/lib/rate-limit', () => ({
  rateLimitMiddleware: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/lib/team-invites', () => ({
  generateInviteToken: jest.fn().mockReturnValue('tok-123456789012345678901234'),
  hashInviteToken: jest.fn().mockReturnValue('hash'),
  inviteExpiryDate: jest.fn().mockReturnValue(new Date('2099-01-01')),
  buildInviteAcceptUrl: jest.fn().mockReturnValue('http://accept/url'),
}))
jest.mock('@/lib/email', () => ({
  emailProvider: { send: jest.fn().mockResolvedValue({}) },
}))
jest.mock('@/lib/email/from', () => ({ emailFrom: () => 'noreply@test.com' }))
jest.mock('@/lib/email/templates', () => ({
  buildInviteEmail: () => ({ subject: 's', html: '<p>s</p>' }),
  buildTransferEmail: () => ({ subject: 's', html: '<p>s</p>' }),
}))
jest.mock('@/lib/sanitize', () => ({ sanitizeUrl: (u: string) => u }))
jest.mock('@/lib/team-helpers', () => ({ syncTeamCounts: jest.fn().mockResolvedValue(undefined) }))

import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { POST as invitePOST } from '@/app/api/creator/team/invites/route'
import { PATCH as membersPATCH, DELETE as membersDELETE } from '@/app/api/creator/team/members/route'
import { PATCH as contactsPATCH } from '@/app/api/creator/team/contacts/[id]/route'
import { PATCH as tabsPATCH } from '@/app/api/creator/team/custom-tabs/[id]/route'
import { POST as transferNominatePOST } from '@/app/api/creator/team/transfer/nominate/route'
import { GET as statsGET } from '@/app/api/creator/team/stats/route'

const mockAuth = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as Record<string, Record<string, jest.Mock>>

function jsonReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/x', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function getReq(search = ''): NextRequest {
  return new NextRequest(`http://localhost/x${search}`)
}

function setRole(role: string) {
  ;(db.teamMembership.findUnique as jest.Mock).mockResolvedValue({
    role,
    status: 'active',
  })
}

const memberRow = {
  id: 'm-1',
  teamId: 't1',
  userId: 'u2',
  role: 'member',
  status: 'active',
  user: { id: 'u2', username: 'bob', email: 'bob@test.com' },
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue({
    user: { id: 'u1', username: 'alice', role: 'creator' },
    error: null,
  })
  mockOwned.mockResolvedValue({ id: 't1', name: 'Team A', slug: 'team-a', ownerId: 'u1' })
  setRole('owner')
  mockDb.team.findUnique.mockResolvedValue(null)
  mockDb.teamMembership.count.mockResolvedValue(0)
  mockDb.teamMembership.findFirst.mockResolvedValue(null)
  mockDb.teamMembership.create.mockResolvedValue({ id: 'm-1' })
  mockDb.teamMembership.update.mockResolvedValue({ id: 'm-1' })
  mockDb.teamInvitation.count.mockResolvedValue(0)
  mockDb.teamInvitation.findFirst.mockResolvedValue(null)
  mockDb.teamInvitation.create.mockResolvedValue({ id: 'inv-1' })
  mockDb.teamContactLink.findFirst.mockResolvedValue({
    id: 'c-1',
    teamId: 't1',
    type: 'website',
  })
  mockDb.teamContactLink.update.mockResolvedValue({ id: 'c-1' })
  mockDb.teamCustomTab.findFirst.mockResolvedValue({ id: 'tab-1', teamId: 't1' })
  mockDb.teamCustomTab.update.mockResolvedValue({ id: 'tab-1' })
  mockDb.mod.findUnique.mockResolvedValue({
    id: 'mod-1',
    authorId: 'u1',
    teamId: null,
    name: 'Mod One',
  })
  mockDb.mod.findMany.mockResolvedValue([])
  mockDb.mod.update.mockResolvedValue({ id: 'mod-1' })
  mockDb.user.findUnique.mockResolvedValue({
    id: 'u2',
    username: 'bob',
    email: 'bob@test.com',
  })
})

describe('permission matrix — mutator routes', () => {
  it('owner can do everything', async () => {
    setRole('owner')
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(201)
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(memberRow)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'admin' }))).status,
    ).toBe(200)
    expect(
      (await membersDELETE(getReq('?memberId=m-1'))).status,
    ).toBe(200)
    expect(
      (await contactsPATCH(jsonReq({ label: 'Web' }), { params: Promise.resolve({ id: 'c-1' }) } as any)).status,
    ).toBe(200)
    expect(
      (await tabsPATCH(jsonReq({ title: 'News' }), { params: Promise.resolve({ id: 'tab-1' }) } as any)).status,
    ).toBe(200)
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(memberRow)
    expect((await transferNominatePOST(jsonReq({ memberId: 'm-1' }))).status).toBe(201)
  })

  it('admin can edit members/invite/contacts but NOT transfer ownership', async () => {
    setRole('admin')
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(201)
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(memberRow)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'member' }))).status,
    ).toBe(200)
    expect(
      (await membersDELETE(getReq('?memberId=m-1'))).status,
    ).toBe(200)
    expect(
      (await contactsPATCH(jsonReq({ label: 'Web' }), { params: Promise.resolve({ id: 'c-1' }) } as any)).status,
    ).toBe(200)
    expect((await transferNominatePOST(jsonReq({ memberId: 'm-1' }))).status).toBe(403)
  })

  it('moderator can invite and manage contacts/tabs but NOT change role or transfer', async () => {
    setRole('moderator')
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(201)
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(memberRow)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'member' }))).status,
    ).toBe(403)
    expect(
      (await membersDELETE(getReq('?memberId=m-1'))).status,
    ).toBe(403)
    expect(
      (await contactsPATCH(jsonReq({ label: 'Web' }), { params: Promise.resolve({ id: 'c-1' }) } as any)).status,
    ).toBe(200)
    expect((await transferNominatePOST(jsonReq({ memberId: 'm-1' }))).status).toBe(403)
  })

  it('translator can only view', async () => {
    setRole('translator')
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(403)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'member' }))).status,
    ).toBe(403)
    expect(
      (await contactsPATCH(jsonReq({ label: 'Web' }), { params: Promise.resolve({ id: 'c-1' }) } as any)).status,
    ).toBe(403)
    expect((await transferNominatePOST(jsonReq({ memberId: 'm-1' }))).status).toBe(403)
  })

  it('member can only view', async () => {
    setRole('member')
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(403)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'member' }))).status,
    ).toBe(403)
  })

  it('tester can only view', async () => {
    setRole('tester')
    expect((await invitePOST(jsonReq({ email: 'bob@test.com' }))).status).toBe(403)
    expect(
      (await membersPATCH(jsonReq({ memberId: 'm-1', role: 'member' }))).status,
    ).toBe(403)
  })
})

describe('permission matrix — viewer routes', () => {
  it('every role can view stats', async () => {
    for (const role of ['owner', 'admin', 'moderator', 'translator', 'member', 'tester']) {
      setRole(role)
      expect((await statsGET(getReq())).status).toBe(200)
    }
  })
})
