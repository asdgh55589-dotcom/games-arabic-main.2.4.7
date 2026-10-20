import { POST as creatorPOST } from '@/app/api/creator/mods/route'
import { PATCH as creatorPATCH } from '@/app/api/creator/mods/[id]/route'

jest.mock('@/lib/auth', () => ({ requireCreatorStudio: jest.fn() }))
jest.mock('@/lib/db', () => ({
  db: {
    mod: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    game: { findFirst: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: { create: jest.fn() },
    category: { findUnique: jest.fn() },
    section: { findUnique: jest.fn() },
    team: { findUnique: jest.fn() },
    series: { findUnique: jest.fn() },
    teamMembership: { findFirst: jest.fn() },
  },
}))
jest.mock('@/lib/rate-limit', () => ({ rateLimitMiddleware: jest.fn().mockResolvedValue(null) }))
jest.mock('@/lib/permissions', () => ({ canCreateMod: jest.fn().mockReturnValue(true), canTranslateMod: jest.fn().mockReturnValue(true) }))
jest.mock('@/lib/mod-relations', () => ({ stripModRelations: jest.fn().mockImplementation((d: unknown) => ({ ...(d as object) })), syncModRelations: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/utils', () => ({ slugify: jest.fn().mockReturnValue('test-mod') }))

import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
function postReq(body: unknown) { return new NextRequest('http://localhost/api/creator/mods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
function patchReq(id: string, body: unknown) { return new NextRequest(`http://localhost/api/creator/mods/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) }
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })

const CREATOR = { id: 'u1', username: 'ali', email: 'a@t', role: 'creator' }
const BASE = { name: 'Test Mod', headline: 'H', description: 'وصف طويل بما فيه الكفاية لاجتياز التحقق', thumbnailUrl: 'https://x.test/t.png', imageUrl: 'https://x.test/i.png' }

beforeEach(() => {
  jest.clearAllMocks()
  ;(requireCreatorStudio as jest.Mock).mockResolvedValue({ user: CREATOR, error: null })
  ;(db.game.findFirst as jest.Mock).mockResolvedValue({ id: 'g1' })
  ;(db.mod.findUnique as jest.Mock).mockResolvedValue({ id: 'm1', authorId: 'u1', workflowStatus: 'DRAFT', gameId: 'g1' })
  ;(db.mod.create as jest.Mock).mockImplementation((a: unknown) => Promise.resolve({ id: 'm1', ...(a as { data: object }).data }))
  ;(db.mod.update as jest.Mock).mockImplementation((a: unknown) => Promise.resolve({ id: 'm1', ...(a as { data: object }).data }))
  ;(db.category.findUnique as jest.Mock).mockResolvedValue({ id: 'c1' })
  ;(db.section.findUnique as jest.Mock).mockResolvedValue({ id: 's1' })
})

describe('mass-assignment: privileged fields rejected', () => {
  for (const field of ['isFeatured', 'isTrending', 'isLatest']) {
    it(`POST rejects ${field}`, async () => {
      const res = await creatorPOST(postReq({ ...BASE, [field]: true }))
      expect(res.status).toBe(403)
    })
    it(`PATCH rejects ${field}`, async () => {
      const res = await creatorPATCH(patchReq('m1', { [field]: true }), paramsOf('m1'))
      expect(res.status).toBe(403)
    })
  }
})

describe('mass-assignment: teamId membership', () => {
  it('POST rejects team not owned/membership', async () => {
    ;(db.team.findUnique as jest.Mock).mockResolvedValue({ id: 't1', ownerId: 'other' })
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq({ ...BASE, teamId: 't1' }))
    expect(res.status).toBe(403)
  })
  it('POST allows team owned by creator', async () => {
    ;(db.team.findUnique as jest.Mock).mockResolvedValue({ id: 't1', ownerId: 'u1' })
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq({ ...BASE, teamId: 't1' }))
    expect(res.status).toBe(201)
  })
  it('POST allows team where creator is member', async () => {
    ;(db.team.findUnique as jest.Mock).mockResolvedValue({ id: 't1', ownerId: 'other' })
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue({ id: 'tm1' })
    const res = await creatorPOST(postReq({ ...BASE, teamId: 't1' }))
    expect(res.status).toBe(201)
  })
  it('POST rejects non-existent team', async () => {
    ;(db.team.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq({ ...BASE, teamId: 'nope' }))
    expect(res.status).toBe(422)
  })
  it('PATCH rejects unauthorized team', async () => {
    ;(db.team.findUnique as jest.Mock).mockResolvedValue({ id: 't1', ownerId: 'other' })
    ;(db.teamMembership.findFirst as jest.Mock).mockResolvedValue(null)
    const res = await creatorPATCH(patchReq('m1', { teamId: 't1' }), paramsOf('m1'))
    expect(res.status).toBe(403)
  })
})

describe('mass-assignment: seriesId existence', () => {
  it('POST rejects non-existent series', async () => {
    ;(db.series.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPOST(postReq({ ...BASE, seriesId: 'nope' }))
    expect(res.status).toBe(422)
  })
  it('POST allows existing series', async () => {
    ;(db.series.findUnique as jest.Mock).mockResolvedValue({ id: 'ser1' })
    const res = await creatorPOST(postReq({ ...BASE, seriesId: 'ser1' }))
    expect(res.status).toBe(201)
  })
  it('PATCH rejects non-existent series', async () => {
    ;(db.series.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await creatorPATCH(patchReq('m1', { seriesId: 'nope' }), paramsOf('m1'))
    expect(res.status).toBe(422)
  })
})
