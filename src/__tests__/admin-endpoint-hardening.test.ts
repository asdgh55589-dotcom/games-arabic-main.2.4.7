/**
 * Phase 1 endpoint-hardening tests.
 *
 * Three admin routes shipped with no in-handler gate at all:
 *   - GET /api/admin/search           — public, unbounded, writes an audit row
 *   - GET /api/admin/leaderboard      — public, unbounded aggregate query
 *   - GET /api/admin/scheduled-publish/check — public + MUTATING cron job
 *
 * These tests pin the new contract: auth FIRST (401/403/501), then the rate
 * limiter (429 + Retry-After), then the handler body.
 */

import { NextRequest } from 'next/server'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/audit', () => ({
  logAction: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(),
  rateLimitHeaders: jest.fn().mockReturnValue({}),
}))

const mockRequireAdmin = jest.fn()
jest.mock('@/lib/auth', () => ({
  requireAdmin: (...a: Array<any>) => mockRequireAdmin(...a),
}))

const mockSearch = jest.fn()
jest.mock('@/lib/search', () => ({
  search: (...a: Array<any>) => mockSearch(...a),
}))

const mockModFindMany = jest.fn()
const mockModUpdate = jest.fn()
const mockAuditLogCreate = jest.fn()
const mockTeamPointsFindMany = jest.fn()
const mockPointsTxGroupBy = jest.fn()
const mockTeamAchGroupBy = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    mod: { findMany: mockModFindMany, update: mockModUpdate },
    auditLog: { create: mockAuditLogCreate },
    teamPoints: { findMany: mockTeamPointsFindMany },
    pointsTransaction: { groupBy: mockPointsTxGroupBy },
    teamAchievement: { groupBy: mockTeamAchGroupBy },
  },
}))

import { GET as leaderboardGET } from '@/app/api/admin/leaderboard/route'
import { GET as scheduledCheckGET } from '@/app/api/admin/scheduled-publish/check/route'
import { GET as searchGET } from '@/app/api/admin/search/route'
import { rateLimit } from '@/lib/rate-limit'

const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>

const CRON_SECRET = 'cron-secret-for-jest'

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://x${path}`, {
    method: 'GET',
    headers: { 'x-forwarded-for': '5.5.5.5', ...headers },
  })
}

function authError(status: number) {
  return Object.assign(new Error(`auth ${status}`), { status })
}

function allow(limit = 30, window = 60) {
  mockRateLimit.mockResolvedValue({
    success: true,
    limit,
    remaining: limit - 1,
    resetAt: Date.now() + window * 1000,
  } as any)
}

function tripLimit() {
  mockRateLimit.mockResolvedValue({
    success: false,
    limit: 30,
    remaining: 0,
    resetAt: Date.now() + 30_000,
  } as any)
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
  allow()
  mockRequireAdmin.mockResolvedValue(undefined)
  mockTeamAchGroupBy.mockResolvedValue([])
  mockTeamPointsFindMany.mockResolvedValue([])
  mockModFindMany.mockResolvedValue([])
})

describe('GET /api/admin/search', () => {
  it('401s an anonymous caller without running the query', async () => {
    mockRequireAdmin.mockRejectedValue(authError(401))
    mockSearch.mockResolvedValue({ results: [], counts: {}, total: 0 })

    const res = await searchGET(req('/api/admin/search?q=test'))

    expect(res.status).toBe(401)
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('403s a non-admin caller', async () => {
    mockRequireAdmin.mockRejectedValue(authError(403))

    const res = await searchGET(req('/api/admin/search?q=test'))

    expect(res.status).toBe(403)
  })

  it('checks auth BEFORE the rate limiter so anonymous floods cost nothing', async () => {
    mockRequireAdmin.mockRejectedValue(authError(401))

    await searchGET(req('/api/admin/search?q=test'))

    expect(mockRateLimit).not.toHaveBeenCalled()
  })

  it('429s when the limiter trips and never queries', async () => {
    tripLimit()

    const res = await searchGET(req('/api/admin/search?q=test'))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('keeps the legacy {results, counts} root shape for the admin UI', async () => {
    mockSearch.mockResolvedValue({
      results: [{ id: '1' }],
      counts: { mod: 1 },
      total: 1,
    })

    const res = await searchGET(req('/api/admin/search?q=test'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      results: [{ id: '1' }],
      counts: { mod: 1 },
    })
  })
})

describe('GET /api/admin/leaderboard', () => {
  it('401s an anonymous caller without querying the DB', async () => {
    mockRequireAdmin.mockRejectedValue(authError(401))

    const res = await leaderboardGET(req('/api/admin/leaderboard'))

    expect(res.status).toBe(401)
    expect(mockTeamPointsFindMany).not.toHaveBeenCalled()
  })

  it('429s when the limiter trips', async () => {
    tripLimit()

    const res = await leaderboardGET(req('/api/admin/leaderboard'))

    expect(res.status).toBe(429)
    expect(mockTeamPointsFindMany).not.toHaveBeenCalled()
  })

  it('keeps the legacy {leaderboard} root shape for the rewards page', async () => {
    const res = await leaderboardGET(req('/api/admin/leaderboard?range=all_time'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      leaderboard: [],
      timeRange: 'all_time',
    })
  })
})

describe('GET /api/admin/scheduled-publish/check', () => {
  it('401s without the CRON_SECRET bearer token and publishes nothing', async () => {
    const res = await scheduledCheckGET(req('/api/admin/scheduled-publish/check'))

    expect(res.status).toBe(401)
    expect(mockModUpdate).not.toHaveBeenCalled()
  })

  it('401s on a wrong bearer token', async () => {
    const res = await scheduledCheckGET(
      req('/api/admin/scheduled-publish/check', { authorization: 'Bearer nope' }),
    )

    expect(res.status).toBe(401)
    expect(mockModUpdate).not.toHaveBeenCalled()
  })

  it('501s (fails closed) when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET

    const res = await scheduledCheckGET(
      req('/api/admin/scheduled-publish/check', { authorization: 'Bearer whatever' }),
    )

    expect(res.status).toBe(501)
  })

  it('429s when the limiter trips even with a valid secret', async () => {
    tripLimit()

    const res = await scheduledCheckGET(
      req('/api/admin/scheduled-publish/check', { authorization: `Bearer ${CRON_SECRET}` }),
    )

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockModUpdate).not.toHaveBeenCalled()
  })

  it('publishes due mods for an authenticated cron caller', async () => {
    mockModFindMany.mockResolvedValue([
      { id: 'm-1', name: 'Due Mod', scheduledAt: new Date(0), authorId: 'u-1' },
    ])
    mockModUpdate.mockResolvedValue({})
    mockAuditLogCreate.mockResolvedValue({})

    const res = await scheduledCheckGET(
      req('/api/admin/scheduled-publish/check', { authorization: `Bearer ${CRON_SECRET}` }),
    )

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      data: { published: 1, mods: [{ id: 'm-1', name: 'Due Mod' }] },
    })
    expect(mockModUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm-1' },
        data: expect.objectContaining({ workflowStatus: 'PUBLISHED', scheduledSent: true }),
      }),
    )
  })
})
