/**
 * Phase 4 — Hardening gaps (cap, activity feed scoping, docs presence).
 */
import { NextRequest } from 'next/server'
import { POST as CREATE_INVITE } from '@/app/api/creator/team/invites/route'
import { GET as TEAM_ACTIVITY } from '@/app/api/creator/team/activity/route'
import { ALL_DOCS } from '@/lib/docs/mod-form-docs'

jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: jest.fn() },
    teamMembership: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    teamInvitation: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    auditLog: { count: jest.fn(), findMany: jest.fn() },
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

import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockStudio = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as {
  user: { findUnique: jest.Mock }
  teamMembership: { count: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock }
  teamInvitation: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock }
  auditLog: { count: jest.Mock; findMany: jest.Mock }
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
  mockStudio.mockResolvedValue({ user: ownerUser, error: null })
  mockOwned.mockResolvedValue(ownedTeam)
  mockDb.notification.create.mockResolvedValue({ id: 'n1' })
})

describe('member cap (50/team)', () => {
  it('rejects invites when the team is full', async () => {
    mockDb.user.findUnique.mockResolvedValue({ id: 'u-2', username: 'sara', email: 's@t.com' })
    mockDb.teamMembership.findFirst.mockResolvedValue(null)
    mockDb.teamMembership.count.mockResolvedValue(50)
    mockDb.teamInvitation.findFirst.mockResolvedValue(null)

    const res = await CREATE_INVITE(req('POST', { username: 'sara', role: 'member' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(JSON.stringify(json)).toMatch(/الأقصى/)
    expect(mockDb.teamInvitation.create).not.toHaveBeenCalled()
  })
})

describe('activity feed scoping', () => {
  it('returns 404 when the caller owns no team', async () => {
    mockOwned.mockResolvedValue(null)
    const res = await TEAM_ACTIVITY(req('GET'))
    expect(res.status).toBe(404)
    expect(mockDb.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('scopes audit rows to owned-team entity ids only', async () => {
    mockDb.teamMembership.findMany.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }])
    mockDb.teamInvitation.findMany.mockResolvedValue([{ id: 'inv1' }])
    mockDb.auditLog.count.mockResolvedValue(1)
    mockDb.auditLog.findMany.mockResolvedValue([
      { id: 'a1', action: 'INVITE_CREATED', username: 'owner-ali', entity: 'TeamInvitation', entityId: 'inv1', createdAt: new Date() },
    ])

    const res = await TEAM_ACTIVITY(req('GET', undefined, 'http://localhost/x?page=1&limit=20'))
    expect(res.status).toBe(200)
    const where = mockDb.auditLog.findMany.mock.calls[0][0].where
    expect(where.entityId.in).toEqual(expect.arrayContaining(['t1', 'm1', 'm2', 'inv1']))
    expect(where.entityId.in).not.toContain('foreign-id')
    // IP addresses are admin-only and must not be selected.
    expect(mockDb.auditLog.findMany.mock.calls[0][0].select).not.toHaveProperty('ipAddress')
  })

  it('paginates with a 20-row default and 50-row ceiling', async () => {
    mockDb.teamMembership.findMany.mockResolvedValue([])
    mockDb.teamInvitation.findMany.mockResolvedValue([])
    mockDb.auditLog.count.mockResolvedValue(0)
    mockDb.auditLog.findMany.mockResolvedValue([])

    await TEAM_ACTIVITY(req('GET', undefined, 'http://localhost/x'))
    expect(mockDb.auditLog.findMany.mock.calls[0][0].take).toBe(20)

    await TEAM_ACTIVITY(req('GET', undefined, 'http://localhost/x?limit=500'))
    expect(mockDb.auditLog.findMany.mock.calls[1][0].take).toBe(50)
  })
})

describe('team docs presence', () => {
  it('registers the team guide with invitation + roles + limits sections', () => {
    const page = ALL_DOCS.find((p) => p.id === 'team')
    expect(page).toBeDefined()
    const sectionIds = page?.sections.map((s) => s.id) ?? []
    expect(sectionIds).toEqual(expect.arrayContaining(['create', 'roles', 'invites', 'limits']))
    const allText = JSON.stringify(page)
    expect(allText).toMatch(/7 أيام/)
    expect(allText).toMatch(/50/)
  })
})
