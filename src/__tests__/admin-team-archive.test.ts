import * as fs from 'node:fs'
import * as path from 'node:path'
import { NextRequest } from 'next/server'

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const mockRequireModerator = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireModerator: (...a: Array<any>) => mockRequireModerator(...a),
}))

jest.mock('@/lib/utils', () => ({
  slugify: (s: string) => s.toLowerCase().trim().replace(/\s+/g, '-'),
}))

const mockTeamFindUnique = jest.fn()
const mockTeamUpdate = jest.fn()
const mockTeamFindMany = jest.fn()
const mockTeamFindFirst = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    team: {
      findUnique: (...a: Array<any>) => mockTeamFindUnique(...a),
      update: (...a: Array<any>) => mockTeamUpdate(...a),
      findMany: (...a: Array<any>) => mockTeamFindMany(...a),
      findFirst: (...a: Array<any>) => mockTeamFindFirst(...a),
    },
  },
}))

jest.mock('@/lib/counters', () => ({
  recordTeamView: jest.fn().mockResolvedValue(undefined),
  isInternalRequest: jest.fn().mockReturnValue(false),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({
    success: true,
    limit: 300,
    remaining: 299,
    resetAt: Date.now() + 60_000,
  })),
  rateLimitHeaders: jest.fn(() => ({})),
}))

import { PATCH } from '@/app/api/admin/teams/[id]/route'
import { GET as TEAMS_LIST } from '@/app/api/teams/route'
import { GET as TEAM_DETAIL } from '@/app/api/teams/[slug]/route'

const ctx = { params: Promise.resolve({ id: 't1' }) }

function patchReq(body: unknown) {
  return new NextRequest('http://x/api/admin/teams/t1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireModerator.mockResolvedValue({ id: 'mod-1', role: 'moderator' })
})

describe('PATCH /api/admin/teams/[id]', () => {
  it('archived:true stamps archivedAt with a real timestamp', async () => {
    mockTeamFindUnique.mockResolvedValue({ id: 't1', name: 'Team' })
    mockTeamUpdate.mockResolvedValue({ id: 't1', archivedAt: new Date('2026-10-23') })

    const res = await PATCH(patchReq({ archived: true }), ctx)

    expect(res.status).toBe(200)
    expect(mockTeamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        data: { archivedAt: expect.any(Date) },
      }),
    )
    const body = await res.json()
    expect(body.data.id).toBe('t1')
  })

  it('archived:false clears archivedAt', async () => {
    mockTeamFindUnique.mockResolvedValue({ id: 't1', archivedAt: new Date('2026-01-01') })
    mockTeamUpdate.mockResolvedValue({ id: 't1', archivedAt: null })

    const res = await PATCH(patchReq({ archived: false }), ctx)

    expect(res.status).toBe(200)
    expect(mockTeamUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { archivedAt: null },
    })
  })

  it('rejects a non-boolean archived value with 400 and never writes', async () => {
    const res = await PATCH(patchReq({ archived: 'yes' }), ctx)

    expect(res.status).toBe(400)
    expect(mockTeamFindUnique).not.toHaveBeenCalled()
    expect(mockTeamUpdate).not.toHaveBeenCalled()
  })

  it('404s when the team does not exist', async () => {
    mockTeamFindUnique.mockResolvedValue(null)

    const res = await PATCH(patchReq({ archived: true }), ctx)

    expect(res.status).toBe(404)
    expect(mockTeamUpdate).not.toHaveBeenCalled()
  })
})

describe('public surfaces hide archived teams', () => {
  it('GET /api/teams filters archivedAt:null', async () => {
    mockTeamFindMany.mockResolvedValue([])

    const res = await TEAMS_LIST(new NextRequest('http://x/api/teams'))

    expect(res.status).toBe(200)
    expect(mockTeamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { archivedAt: null } }),
    )
  })

  it('GET /api/teams/[slug] uses findFirst with slug + archivedAt:null and 404s', async () => {
    mockTeamFindFirst.mockResolvedValue(null)

    const res = await TEAM_DETAIL(new NextRequest('http://x/api/teams/hidden'), {
      params: Promise.resolve({ slug: 'hidden' }),
    })

    expect(res.status).toBe(404)
    expect(mockTeamFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'hidden', archivedAt: null } }),
    )
  })

  it('GET /api/teams/[slug] still serves a visible team', async () => {
    mockTeamFindFirst.mockResolvedValue({
      id: 't1',
      views: 0,
      mods: [],
      memberships: [],
      _count: { mods: 0, memberships: 0, follows: 0 },
    })

    const res = await TEAM_DETAIL(new NextRequest('http://x/api/teams/visible'), {
      params: Promise.resolve({ slug: 'visible' }),
    })

    expect(res.status).toBe(200)
  })

  it('Prisma search + lib/search + Meili indexer exclude archived teams', () => {
    const searchRoute = read('src/app/api/search/route.ts')
    const searchLib = read('src/lib/search.ts')
    const indexer = read('src/lib/meilisearch/indexer.ts')

    expect((searchRoute.match(/archivedAt: null/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(searchLib).toMatch(/archivedAt: null/)
    expect(indexer).toMatch(/seedTeamsIndex[\s\S]*?where: \{ archivedAt: null \}/)
  })
})

describe('TeamActions archive wiring', () => {
  it('has no isFeatured fallback and only reports success after a successful PATCH', () => {
    const src = read('src/components/admin/teams/TeamActions.tsx')
    const start = src.indexOf('const handleArchive')
    const end = src.indexOf('const handleDelete')
    const archive = src.slice(start, end)

    expect(archive).toMatch(/method: 'PATCH'/)
    expect(archive).not.toMatch(/isFeatured/)
    expect(archive).toMatch(/if \(!res\.ok\)/)
    expect(archive).toMatch(/throw new Error/)
    expect(archive).toMatch(/لن يظهر للعامة/)
    expect(archive).toMatch(/onActionComplete\(\)/)
    expect(archive.indexOf('if (!res.ok) throw')).toBeLessThan(
      archive.indexOf('لن يظهر للعامة'),
    )
  })
})
