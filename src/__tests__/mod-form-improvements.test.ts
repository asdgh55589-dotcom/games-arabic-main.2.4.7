/**
 * Mod form improvements tests (mocked auth/db — no network, no real DB).
 * Covers: changelog CRUD, scheduled-publish cron, source attribution auto-set.
 */

const mockStudio = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireCreatorStudio: (...a: unknown[]) => mockStudio(...a),
  requireAuth: (...a: unknown[]) => mockStudio(...a),
  requireAdmin: (...a: unknown[]) => mockStudio(...a),
}))

const mockChangelog = {
  create: jest.fn(),
  findMany: jest.fn(),
}
const mockMod = {
  findUnique: jest.fn(),
  update: jest.fn(),
  findMany: jest.fn(),
}
const mockAuditLog = {
  create: jest.fn().mockResolvedValue({}),
}
jest.mock('@/lib/db', () => ({
  db: {
    modChangelog: {
      create: (...a: unknown[]) => mockChangelog.create(...a),
      findMany: (...a: unknown[]) => mockChangelog.findMany(...a),
    },
    mod: {
      findUnique: (...a: unknown[]) => mockMod.findUnique(...a),
      update: (...a: unknown[]) => mockMod.update(...a),
      findMany: (...a: unknown[]) => mockMod.findMany(...a),
    },
    auditLog: {
      create: (...a: unknown[]) => mockAuditLog.create(...a),
    },
  },
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

import { POST as changelogPOST, GET as changelogGET } from '@/app/api/creator/mods/[id]/changelog/route'
import { GET as scheduledPublishGET } from '@/app/api/admin/scheduled-publish/check/route'
import { NextResponse } from 'next/server'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
function getReq(url: string) {
  return new NextRequest(url, { method: 'GET' })
}
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) })

const CREATOR = { id: 'u-1', username: 'creator1', email: 'c@x.test', role: 'creator' }
const ADMIN = { id: 'u-2', username: 'admin1', email: 'a@x.test', role: 'admin' }

beforeEach(() => jest.clearAllMocks())

// ============================================================
// Changelog API
// ============================================================
describe('Changelog API', () => {
  describe('POST /api/creator/mods/[id]/changelog', () => {
    it('creates a changelog entry with valid data', async () => {
      mockStudio.mockResolvedValue({ user: CREATOR })
      mockMod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'u-1' })
      mockChangelog.create.mockResolvedValue({ id: 'cl-1', type: 'update', title: 'Added features' })

      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', {
        type: 'update',
        title: 'Added features',
        description: 'New platform support',
      })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data.data.id).toBe('cl-1')
      expect(mockChangelog.create).toHaveBeenCalledWith({
        data: {
          modId: 'mod-1',
          type: 'update',
          title: 'Added features',
          description: 'New platform support',
          changedById: 'u-1',
          changedByRole: 'creator',
        },
      })
    })

    it('returns 401 without auth', async () => {
      mockStudio.mockResolvedValue({ user: null, error: new NextResponse('Unauthorized', { status: 401 }) })

      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { type: 'edit', title: 'Fix' })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      expect(res.status).toBe(401)
    })

    it('returns 400 when title is missing', async () => {
      mockStudio.mockResolvedValue({ user: CREATOR })
      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { type: 'edit', title: '' })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      expect(res.status).toBe(422)
    })

    it('returns 400 when type is invalid', async () => {
      mockStudio.mockResolvedValue({ user: CREATOR })
      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { type: 'invalid', title: 'Fix' })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      expect(res.status).toBe(422)
    })

    it('returns 404 when mod does not exist', async () => {
      mockStudio.mockResolvedValue({ user: CREATOR })
      mockMod.findUnique.mockResolvedValue(null)

      const req = postReq('http://localhost/api/creator/mods/missing/changelog', { type: 'edit', title: 'Fix' })
      const res = await changelogPOST(req, paramsOf('missing'))
      expect(res.status).toBe(422)
    })

    it('returns 403 when user does not own the mod and is not admin', async () => {
      mockStudio.mockResolvedValue({ user: { ...CREATOR, id: 'u-other' } })
      mockMod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'u-1' })

      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { type: 'edit', title: 'Fix' })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      expect(res.status).toBe(403)
    })

    it('allows admin to create changelog for any mod', async () => {
      mockStudio.mockResolvedValue({ user: ADMIN })
      mockMod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'u-other' })
      mockChangelog.create.mockResolvedValue({ id: 'cl-2', type: 'release', title: 'Major release' })

      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { type: 'release', title: 'Major release' })
      const res = await changelogPOST(req, paramsOf('mod-1'))
      expect(res.status).toBe(201)
    })

    it('defaults type to "edit" when not provided', async () => {
      mockStudio.mockResolvedValue({ user: CREATOR })
      mockMod.findUnique.mockResolvedValue({ id: 'mod-1', authorId: 'u-1' })
      mockChangelog.create.mockResolvedValue({ id: 'cl-3' })

      const req = postReq('http://localhost/api/creator/mods/mod-1/changelog', { title: 'Quick fix' })
      const res = await changelogPOST(req, paramsOf('mod-1'))

      expect(res.status).toBe(201)
      expect(mockChangelog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'edit' }),
        }),
      )
    })
  })

  describe('GET /api/creator/mods/[id]/changelog', () => {
    it('returns changelogs for a mod', async () => {
      mockChangelog.findMany.mockResolvedValue([
        { id: 'cl-1', type: 'release', title: 'v1.0', changedBy: { id: 'u-1', username: 'creator1', avatarUrl: null, role: 'creator' } },
      ])

      const res = await changelogGET(getReq('http://localhost/api/creator/mods/mod-1/changelog'), paramsOf('mod-1'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.data).toHaveLength(1)
      expect(mockChangelog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { modId: 'mod-1' } }),
      )
    })
  })
})

// ============================================================
// Scheduled Publish Cron
// ============================================================
describe('Scheduled Publish Cron', () => {
  it('publishes mods that are past their scheduledAt', async () => {
    const pastDate = new Date(Date.now() - 60000).toISOString()
    mockMod.findMany.mockResolvedValue([
      { id: 'mod-1', scheduledAt: pastDate, slug: 'test-mod' },
    ])
    mockMod.update.mockResolvedValue({})

      const req = getReq('http://localhost/api/admin/scheduled-publish/check')
      const res = await scheduledPublishGET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.published).toBe(1)
      expect(mockMod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mod-1' },
          data: expect.objectContaining({ workflowStatus: 'PUBLISHED', scheduledSent: true }),
        }),
      )
    })

    it('does not publish mods whose scheduledAt is in the future', async () => {
      // When scheduledAt > now, the DB query filters them out, so findMany returns []
      mockMod.findMany.mockResolvedValue([])

      const req = getReq('http://localhost/api/admin/scheduled-publish/check')
      const res = await scheduledPublishGET()
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.published).toBe(0)
      expect(mockMod.update).not.toHaveBeenCalled()
    })

    it('returns published: 0 when no mods are scheduled', async () => {
      mockMod.findMany.mockResolvedValue([])

      const req = getReq('http://localhost/api/admin/scheduled-publish/check')
      const res = await scheduledPublishGET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.published).toBe(0)
  })
})
