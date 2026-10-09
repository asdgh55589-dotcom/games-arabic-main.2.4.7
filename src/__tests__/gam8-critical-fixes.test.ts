/**
 * GAM-8 (GAM-6/A) — critical backend fixes A1/A2/A3/A5.
 * - A1: public mods list/detail never expose DRAFT/IN_REVIEW.
 * - A2: changelog GET requires auth + owner/staff.
 * - A3: concurrent team POST collapses to 409 via @@unique(ownerId).
 * - A5: transfer meta lives on the transfer endpoint; isStaff() is central.
 */
import { NextRequest } from 'next/server'

import { GET as MODS_LIST } from '@/app/api/mods/route'
import { GET as MOD_DETAIL } from '@/app/api/mods/[slug]/route'
import { GET as CHANGELOG_GET } from '@/app/api/creator/mods/[id]/changelog/route'
import { POST as TEAM_POST } from '@/app/api/creator/team/route'
import { GET as TRANSFER_META } from '@/app/api/creator/team/transfer/[token]/route'
import { GET as GAME_MODS } from '@/app/api/games/[slug]/mods/route'
import { GET as SERIES_MODS } from '@/app/api/series/mods/route'
import { GET as AUTHOR_MODS } from '@/app/api/authors/[username]/mods/route'
import { GET as NEIGHBORS } from '@/app/api/mods/[slug]/neighbors/route'
import { GET as SITEMAP } from '@/app/api/settings/sitemap/route'
import { GET as TEAM_DETAIL } from '@/app/api/teams/[slug]/route'
import { GET as ACTIVITY } from '@/app/api/users/[username]/activity/route'
import { isStaff } from '@/lib/roles'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
  requireCreatorStudio: jest.fn(),
  getOptionalSession: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/counters', () => ({
  recordModView: jest.fn().mockResolvedValue(undefined),
  recordTeamView: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/creator-team', () => ({
  getOwnedTeam: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    mod: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    modChangelog: { findMany: jest.fn() },
    modComment: { findMany: jest.fn() },
    endorsement: { findMany: jest.fn() },
    game: { findUnique: jest.fn(), findMany: jest.fn() },
    series: { findFirst: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    siteSetting: { findUnique: jest.fn() },
    team: { findUnique: jest.fn(), findFirst: jest.fn() },
    teamMembership: { create: jest.fn() },
    follow: { findFirst: jest.fn() },
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
  slugify: jest.fn((s: string) => s.toLowerCase().trim().replace(/\s+/g, '-')),
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn().mockResolvedValue(undefined),
}))

import { requireAuth, requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'

const mockRequireAuth = requireAuth as jest.Mock
const mockStudio = requireCreatorStudio as jest.Mock
const mockOwned = getOwnedTeam as jest.Mock
const mockDb = db as unknown as Record<string, Record<string, jest.Mock>>

const owner = {
  id: 'u-owner',
  username: 'owner1',
  email: 'o@t.com',
  role: 'creator',
  avatarUrl: null,
  onboardingCompleted: true,
}

// Next's NextRequest uses its own RequestInit variant (notably `signal` is
// `AbortSignal | undefined`, not DOM's `AbortSignal | null`), so take the
// constructor's own parameter type instead of the DOM global.
function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]): NextRequest {
  return new NextRequest(url, init)
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------- A1 ----------

test('A1: public mods list always filters workflowStatus=PUBLISHED', async () => {
  mockDb.mod.count.mockResolvedValue(0)
  mockDb.mod.findMany.mockResolvedValue([])
  await MODS_LIST(req('http://localhost/api/mods?search=x'))
  expect(mockDb.mod.count).toHaveBeenCalledWith({
    where: expect.objectContaining({ workflowStatus: 'PUBLISHED' }),
  })
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ workflowStatus: 'PUBLISHED' }) }),
  )
})

test('A1: DRAFT mod detail → 404 for anonymous', async () => {
  mockDb.mod.findUnique.mockResolvedValue({ id: 'm1', authorId: 'u-owner', workflowStatus: 'DRAFT' })
  mockRequireAuth.mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 }))
  const res = await MOD_DETAIL(req('http://localhost/api/mods/slug-x'), {
    params: Promise.resolve({ slug: 'slug-x' }),
  })
  expect(res.status).toBe(404)
})

test('A1: DRAFT mod detail → 200 for owner', async () => {
  mockDb.mod.findUnique.mockResolvedValue({ id: 'm1', authorId: 'u-owner', workflowStatus: 'DRAFT' })
  mockRequireAuth.mockResolvedValue(owner)
  const res = await MOD_DETAIL(req('http://localhost/api/mods/slug-x'), {
    params: Promise.resolve({ slug: 'slug-x' }),
  })
  expect(res.status).toBe(200)
})

// ---------- A2 ----------

test('A2: changelog GET → 401 without session', async () => {
  const { unauthorized } = await import('@/lib/api-response')
  mockStudio.mockResolvedValue({ user: null, error: unauthorized('x') })
  const res = await CHANGELOG_GET(req('http://localhost/api/creator/mods/m1/changelog'), {
    params: Promise.resolve({ id: 'm1' }),
  })
  expect(res.status).toBe(401)
  expect(mockDb.modChangelog.findMany).not.toHaveBeenCalled()
})

test('A2: changelog GET → 403 for non-owner non-staff, 200 for owner', async () => {
  mockDb.mod.findUnique.mockResolvedValue({ id: 'm1', authorId: 'u-owner' })
  mockDb.modChangelog.findMany.mockResolvedValue([])

  mockStudio.mockResolvedValue({
    user: { ...owner, id: 'u-stranger' },
    error: null,
  })
  const denied = await CHANGELOG_GET(req('http://localhost/api/creator/mods/m1/changelog'), {
    params: Promise.resolve({ id: 'm1' }),
  })
  expect(denied.status).toBe(403)

  mockStudio.mockResolvedValue({ user: owner, error: null })
  const allowed = await CHANGELOG_GET(req('http://localhost/api/creator/mods/m1/changelog'), {
    params: Promise.resolve({ id: 'm1' }),
  })
  expect(allowed.status).toBe(200)
})

// ---------- A3 ----------

test('A3: team POST race (P2002 on ownerId) → 409', async () => {
  mockStudio.mockResolvedValue({ user: owner, error: null })
  mockOwned.mockResolvedValue(null)
  mockDb.team.findUnique.mockResolvedValue(null)
  const raceErr = Object.assign(new Error('Unique constraint'), {
    code: 'P2002',
    meta: { target: ['ownerId'] },
  })
  mockDb.$transaction.mockRejectedValue(raceErr)

  const res = await TEAM_POST(
    req('http://localhost/api/creator/team', {
      method: 'POST',
      body: JSON.stringify({ name: 'فريقي' }),
    }),
  )
  expect(res.status).toBe(409)
})

// ---------- A5 ----------

test('A5: isStaff() covers moderator..owner only', () => {
  expect(isStaff('moderator')).toBe(true)
  expect(isStaff('admin')).toBe(true)
  expect(isStaff('manager')).toBe(true)
  expect(isStaff('owner')).toBe(true)
  expect(isStaff('creator')).toBe(false)
  expect(isStaff('publisher')).toBe(false)
  expect(isStaff('member')).toBe(false)
  expect(isStaff(null)).toBe(false)
})

test('A5: transfer meta rejects malformed token with 404 (no leak)', async () => {
  mockRequireAuth.mockResolvedValue(owner)
  const res = await TRANSFER_META(req('http://localhost/api/creator/team/transfer/short'), {
    params: Promise.resolve({ token: 'short' }),
  })
  expect(res.status).toBe(404)
})

// ---------- A1-F1: sibling public enumerators ----------

test('A1-F1: game/series/author mods lists filter PUBLISHED', async () => {
  mockDb.game.findUnique.mockResolvedValue({ id: 'g1' })
  mockDb.mod.count.mockResolvedValue(0)
  mockDb.mod.findMany.mockResolvedValue([])
  await GAME_MODS(req('http://localhost/api/games/g/mods'), {
    params: Promise.resolve({ slug: 'g' }),
  })
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ gameId: 'g1', workflowStatus: 'PUBLISHED' }),
    }),
  )

  mockDb.series.findFirst.mockResolvedValue({ id: 's1' })
  await SERIES_MODS(req('http://localhost/api/series/mods?series=s1'))
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ seriesId: 's1', workflowStatus: 'PUBLISHED' }),
    }),
  )

  mockDb.user.findFirst.mockResolvedValue({ id: 'u1', mods: [] })
  await AUTHOR_MODS(req('http://localhost/api/authors/u1/mods'), {
    params: Promise.resolve({ username: 'u1' }),
  })
  expect(mockDb.user.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      select: expect.objectContaining({
        mods: expect.objectContaining({ where: { workflowStatus: 'PUBLISHED' } }),
      }),
    }),
  )
})

test('A1-F1: neighbors + sitemap + team detail expose PUBLISHED only', async () => {
  mockDb.mod.findUnique.mockResolvedValue({ id: 'm1', gameId: 'g1' })
  mockDb.mod.findMany.mockResolvedValue([{ id: 'm1' }])
  const nav = await NEIGHBORS(req('http://localhost/api/mods/slug-x/neighbors'), {
    params: Promise.resolve({ slug: 'slug-x' }),
  })
  expect(nav.status).toBe(200)
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ workflowStatus: 'PUBLISHED' }),
    }),
  )

  mockDb.siteSetting.findUnique.mockResolvedValue(null)
  mockDb.game.findMany.mockResolvedValue([])
  await SITEMAP()
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { workflowStatus: 'PUBLISHED' } }),
  )

  mockDb.team.findFirst.mockResolvedValue({
    id: 't1',
    views: 0,
    mods: [],
    memberships: [],
    _count: { mods: 0, memberships: 0, follows: 0 },
  })
  const team = await TEAM_DETAIL(req('http://localhost/api/teams/t1'), {
    params: Promise.resolve({ slug: 't1' }),
  })
  expect(team.status).toBe(200)
  expect(mockDb.team.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        mods: expect.objectContaining({ where: { workflowStatus: 'PUBLISHED' } }),
      }),
    }),
  )
})

test('A1-F1: public activity hides non-PUBLISHED mods', async () => {
  const { getOptionalSession } = await import('@/lib/auth')
  ;(getOptionalSession as jest.Mock).mockResolvedValue(null)
  mockDb.user.findFirst.mockResolvedValue({ id: 'u1', profileVisibility: 'everyone' })
  mockDb.modComment.findMany.mockResolvedValue([])
  mockDb.mod.findMany.mockResolvedValue([])
  mockDb.endorsement.findMany.mockResolvedValue([])
  const res = await ACTIVITY(req('http://localhost/api/users/u1/activity'), {
    params: Promise.resolve({ username: 'u1' }),
  })
  expect(res.status).toBe(200)
  expect(mockDb.mod.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ authorId: 'u1', workflowStatus: 'PUBLISHED' }),
    }),
  )
  expect(mockDb.modComment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ mod: { workflowStatus: 'PUBLISHED' } }),
    }),
  )
})

test('A5: transfer meta checks nominee binding before disclosing meta', async () => {
  const { hashInviteToken } = await import('@/lib/team-invites')
  void hashInviteToken
  mockRequireAuth.mockResolvedValue({ ...owner, id: 'u-stranger' })
  // findUnique mocked at db level is generic; emulate a pending nomination
  // for another user by spying the transfer route's db call shape:
  mockDb.teamInvitation = { findUnique: jest.fn().mockResolvedValue({
    id: 'n1',
    role: 'owner',
    status: 'pending',
    invitedUserId: 'u-nominee',
    expiresAt: new Date(Date.now() + 86400000),
    team: { id: 't1', name: 'Secret Team', slug: 'secret' },
  }) } as unknown as Record<string, jest.Mock>
  const res = await TRANSFER_META(
    req('http://localhost/api/creator/team/transfer/aaaaaaaaaaaaaaaaaaaa'),
    { params: Promise.resolve({ token: 'aaaaaaaaaaaaaaaaaaaa' }) },
  )
  const json = await res.json()
  expect(res.status).toBe(403)
  expect(JSON.stringify(json)).not.toContain('Secret Team')
})
