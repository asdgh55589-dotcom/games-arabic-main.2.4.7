/**
 * Admin badge API tests (mocked auth/db — no network, no real DB).
 * Covers: PUT grant/revoke/hide/show/reset-counter + validation,
 * settings GET/PUT, recalculate.
 */

const mockModerator = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireModerator: (...a: unknown[]) => mockModerator(...a),
}))

const mockMod = { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() }
const mockSettings = { findUnique: jest.fn(), upsert: jest.fn() }
const mockAudit = { create: jest.fn() }
const mockClicks = { groupBy: jest.fn(), count: jest.fn() }
jest.mock('@/lib/db', () => ({
  db: {
    mod: {
      findUnique: (...a: unknown[]) => mockMod.findUnique(...a),
      findMany: (...a: unknown[]) => mockMod.findMany(...a),
      update: (...a: unknown[]) => mockMod.update(...a),
      count: (...a: unknown[]) => mockMod.count(...a),
    },
    badgeSettings: {
      findUnique: (...a: unknown[]) => mockSettings.findUnique(...a),
      upsert: (...a: unknown[]) => mockSettings.upsert(...a),
    },
    badgeAuditLog: {
      create: (...a: unknown[]) => mockAudit.create(...a),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    downloadClick: {
      groupBy: (...a: unknown[]) => mockClicks.groupBy(...a),
      count: (...a: unknown[]) => mockClicks.count(...a),
    },
  },
}))

jest.mock('@/lib/error-reporting', () => ({ reportError: jest.fn() }))

import { PUT as badgePUT } from '@/app/api/admin/badges/[modId]/route'
import { GET as settingsGET, PUT as settingsPUT } from '@/app/api/admin/badges/settings/route'
import { GET as recalcGET } from '@/app/api/admin/badges/recalculate/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function putReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
const paramsOf = (modId: string) => ({ params: Promise.resolve({ modId }) })
const ADMIN = { id: 'admin-1', role: 'admin' }

const BASE_MOD = {
  id: 'mod-1',
  name: 'Test Mod',
  featuredLevel: null,
  featuredUntil: null,
  trendingUntil: null,
  popularUntil: null,
  hiddenBadges: '',
  downloads: 10,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockModerator.mockResolvedValue(ADMIN)
  mockMod.findUnique.mockResolvedValue({ ...BASE_MOD })
  mockSettings.findUnique.mockResolvedValue(null)
  mockAudit.create.mockResolvedValue({})
})

describe('PUT /api/admin/badges/[modId]', () => {
  it('grants featured with level + duration', async () => {
    mockMod.update.mockResolvedValue({})
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', {
        op: 'grant',
        badge: 'featured',
        level: 3,
        durationDays: 4,
      }),
      paramsOf('mod-1'),
    )
    expect(res.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({ featuredLevel: 3, isFeatured: true }),
    })
    const until = mockMod.update.mock.calls[0][0].data.featuredUntil as Date
    expect(until.getTime() - Date.now()).toBeGreaterThan(3.9 * 24 * 3600 * 1000)
    expect(mockAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ modId: 'mod-1', action: 'GRANT_FEATURED' }),
    })
  })

  it('rejects invalid featured level', async () => {
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', {
        op: 'grant',
        badge: 'featured',
        level: 9,
        durationDays: 4,
      }),
      paramsOf('mod-1'),
    )
    expect(res.status).toBe(422)
    expect(mockMod.update).not.toHaveBeenCalled()
  })

  it('grants trending with duration hours', async () => {
    mockMod.update.mockResolvedValue({})
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', {
        op: 'grant',
        badge: 'trending',
        durationHours: 48,
      }),
      paramsOf('mod-1'),
    )
    expect(res.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({ isTrending: true }),
    })
  })

  it('revokes trending', async () => {
    mockMod.findUnique.mockResolvedValue({ ...BASE_MOD, trendingUntil: new Date() })
    mockMod.update.mockResolvedValue({})
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'revoke', badge: 'trending' }),
      paramsOf('mod-1'),
    )
    expect(res.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { trendingUntil: null, isTrending: false },
    })
  })

  it('hides and shows a badge', async () => {
    mockMod.update.mockResolvedValue({})
    const hide = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'hide', badge: 'popular' }),
      paramsOf('mod-1'),
    )
    expect(hide.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { hiddenBadges: 'popular' },
    })

    mockMod.findUnique.mockResolvedValue({ ...BASE_MOD, hiddenBadges: 'popular' })
    const show = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'show', badge: 'popular' }),
      paramsOf('mod-1'),
    )
    expect(show.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: { hiddenBadges: '' },
    })
  })

  it('resets the download counter', async () => {
    mockMod.update.mockResolvedValue({})
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'reset-counter' }),
      paramsOf('mod-1'),
    )
    expect(res.status).toBe(200)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({ downloads: 0, dailyDownloads: 0 }),
    })
    expect(mockAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'RESET_COUNTER', oldValue: '10' }),
    })
  })

  it('returns 404 for missing mod', async () => {
    mockMod.findUnique.mockResolvedValue(null)
    const res = await badgePUT(
      putReq('http://localhost/api/admin/badges/nope', { op: 'revoke', badge: 'trending' }),
      paramsOf('nope'),
    )
    expect(res.status).toBe(404)
  })

  it('rejects unknown op and rejects time-badge control', async () => {
    const badOp = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'nuke', badge: 'trending' }),
      paramsOf('mod-1'),
    )
    expect(badOp.status).toBe(422)

    // time badges are not controllable: 'new' is not a valid badge name
    const timeBadge = await badgePUT(
      putReq('http://localhost/api/admin/badges/mod-1', { op: 'grant', badge: 'new' }),
      paramsOf('mod-1'),
    )
    expect(timeBadge.status).toBe(422)
    expect(mockMod.update).not.toHaveBeenCalled()
  })
})

describe('badge settings API', () => {
  it('GET returns defaults when no row exists', async () => {
    const res = await settingsGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.settings.trendingThreshold).toBe(50)
    expect(body.data.settings.popularThreshold).toBe(20)
    expect(body.data.settings.featuredTiers).toHaveLength(5)
    expect(body.data.defaults.trendingThreshold).toBe(50)
  })

  it('PUT updates thresholds and tiers', async () => {
    mockSettings.upsert.mockResolvedValue({ id: 'default' })
    const req = putReq('http://localhost/api/admin/badges/settings', {
      trendingThreshold: 80,
      popularThreshold: 30,
      featuredTiers: [{ downloads: 150, durationDays: 3 }],
    })
    const res = await settingsPUT(req)
    expect(res.status).toBe(200)
    expect(mockSettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ trendingThreshold: 80 }),
      update: expect.objectContaining({ trendingThreshold: 80 }),
    })
    expect(mockAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ modId: 'settings', action: 'SETTINGS_UPDATE' }),
    })
  })

  it('PUT rejects invalid thresholds', async () => {
    const req = putReq('http://localhost/api/admin/badges/settings', { trendingThreshold: -5 })
    const res = await settingsPUT(req)
    expect(res.status).toBe(422)
    expect(mockSettings.upsert).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/badges/recalculate', () => {
  it('grants qualified mods and logs the change', async () => {
    const old = new Date(Date.now() - 100 * 3600 * 1000)
    mockMod.findMany.mockResolvedValueOnce([
      {
        id: 'mod-1',
        createdAt: old,
        updatedAt: old,
        isFeatured: false,
        isTrending: false,
        isLatest: false,
        featuredLevel: null,
        featuredUntil: null,
        trendingUntil: null,
        popularUntil: null,
        hiddenBadges: '',
        dailyDownloads: 0,
      },
    ])
    mockClicks.groupBy.mockResolvedValueOnce([{ modId: 'mod-1', _count: { modId: 250 } }])
    mockMod.update.mockResolvedValue({})

    const res = await recalcGET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.data.scanned).toBe(1)
    expect(mockMod.update).toHaveBeenCalledWith({
      where: { id: 'mod-1' },
      data: expect.objectContaining({ isFeatured: true, featuredLevel: 2, isTrending: true }),
    })
    expect(mockAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ modId: 'mod-1', action: 'RECALCULATE' }),
    })
  })

  it('skips unchanged mods without writes', async () => {
    const old = new Date(Date.now() - 100 * 3600 * 1000)
    mockMod.findMany.mockResolvedValueOnce([
      {
        id: 'mod-9',
        createdAt: old,
        updatedAt: old,
        isFeatured: false,
        isTrending: false,
        isLatest: false,
        featuredLevel: null,
        featuredUntil: null,
        trendingUntil: null,
        popularUntil: null,
        hiddenBadges: '',
        dailyDownloads: 3,
      },
    ])
    mockClicks.groupBy.mockResolvedValueOnce([{ modId: 'mod-9', _count: { modId: 3 } }])

    const res = await recalcGET()
    expect(res.status).toBe(200)
    expect(mockMod.update).not.toHaveBeenCalled()
    expect(mockAudit.create).not.toHaveBeenCalled()
  })
})
