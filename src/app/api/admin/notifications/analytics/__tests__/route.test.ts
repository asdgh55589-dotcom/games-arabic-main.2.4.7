/**
 * Tests for GET /api/admin/notifications/analytics — تحليلات التسليم.
 *
 * المسار يحسب معدلات النموّ من نافذتين (حالية/سابقة). الأهم أن النسب تُقسَم
 * على مقام صحيح: قسمة على صفر كانت تُنتج `NaN`/`Infinity` تُرسَم كمستوى في
 * المخططات.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationLog: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireModerator: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { GET } from '../route'

const mockRequireModerator = requireModerator as jest.Mock
const mockFindMany = db.notificationLog.findMany as jest.Mock

const MOD = { id: 'mod-1', role: 'moderator', username: 'mod' }

function log(overrides: Record<string, unknown> = {}) {
  return {
    channel: 'in_app',
    status: 'sent',
    createdAt: new Date('2026-03-01T10:00:00.000Z'),
    notification: { type: 'like' },
    deliveredAt: null,
    openedAt: null,
    clickedAt: null,
    ...overrides,
  }
}

function get(range?: string) {
  const url = range
    ? `http://localhost/api/admin/notifications/analytics?range=${range}`
    : 'http://localhost/api/admin/notifications/analytics'
  return GET(new NextRequest(url))
}

describe('GET /api/admin/notifications/analytics — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
  })

  it('returns zeroed, non-NaN totals for an empty window', async () => {
    mockFindMany.mockResolvedValue([])

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totals).toEqual({ created: 0, delivered: 0, failed: 0, deliveryRate: 0 })
    expect(body.data.comparison).toEqual({ prevTotal: 0, growthRate: 0, deliveryGrowth: 0 })
    expect(body.data.byChannel).toEqual({})
    expect(body.data.byType).toEqual({})
    expect(body.data.timeSeries).toEqual([])
    expect(body.data.emailStats).toEqual({
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      openRate: 0,
      clickRate: 0,
    })
  })

  it('counts delivered vs failed from real rows', async () => {
    mockFindMany.mockResolvedValue([
      log({ status: 'sent' }),
      log({ status: 'sent' }),
      log({ status: 'failed' }),
    ])

    const body = await (await get()).json()

    expect(body.data.totals).toMatchObject({ created: 3, delivered: 2, failed: 1 })
    expect(body.data.totals.deliveryRate).toBeCloseTo((2 / 3) * 100, 5)
  })

  it('breaks results down by channel and by type', async () => {
    mockFindMany.mockResolvedValue([
      log({ channel: 'email', notification: { type: 'like' } }),
      log({ channel: 'email', notification: { type: 'comment_reply' } }),
      log({ channel: 'telegram', notification: { type: 'like' } }),
    ])

    const body = await (await get()).json()

    expect(body.data.byChannel).toEqual({ email: 2, telegram: 1 })
    expect(body.data.byType).toEqual({ like: 2, comment_reply: 1 })
  })

  it('labels a null notification type as "unknown" rather than "undefined"', async () => {
    mockFindMany.mockResolvedValue([log({ notification: null })])

    const body = await (await get()).json()

    expect(body.data.byType).toEqual({ unknown: 1 })
  })

  it('groups the time series by UTC day, sorted ascending', async () => {
    mockFindMany.mockResolvedValue([
      log({ createdAt: new Date('2026-03-02T23:00:00.000Z'), status: 'failed' }),
      log({ createdAt: new Date('2026-03-01T01:00:00.000Z'), status: 'sent' }),
    ])

    const body = await (await get()).json()

    expect(body.data.timeSeries).toEqual([
      { date: '2026-03-01', created: 1, delivered: 1, failed: 0 },
      { date: '2026-03-02', created: 1, delivered: 0, failed: 1 },
    ])
  })

  it('computes open/click rates from the detailed email query', async () => {
    mockFindMany.mockImplementation((args: { select?: Record<string, unknown> }) => {
      const select = args.select ?? {}
      if ('deliveredAt' in select) {
        return Promise.resolve([
          { deliveredAt: new Date(), openedAt: new Date(), clickedAt: null },
          { deliveredAt: new Date(), openedAt: null, clickedAt: null },
          { deliveredAt: null, openedAt: null, clickedAt: null },
          { deliveredAt: null, openedAt: null, clickedAt: null },
        ])
      }
      return Promise.resolve([log({ channel: 'email' })])
    })

    const body = await (await get()).json()

    expect(body.data.emailStats).toMatchObject({ sent: 4, delivered: 2, opened: 1, clicked: 0 })
    expect(body.data.emailStats.openRate).toBe(25)
    expect(body.data.emailStats.clickRate).toBe(0)
  })

  it('defaults to the 7d range and echoes it back', async () => {
    mockFindMany.mockResolvedValue([])

    const body = await (await get()).json()

    expect(body.data.range).toBe('7d')
  })

  it.each([
    ['7d', 7],
    ['30d', 30],
    ['90d', 90],
    ['garbage', 90],
  ])('maps range=%s to a %s-day window', async (range, days) => {
    mockFindMany.mockResolvedValue([])

    const before = Date.now()
    await get(range)
    const after = Date.now()

    const start = (mockFindMany.mock.calls[0][0].where as { createdAt: { gte: Date } }).createdAt
      .gte
    expect(start.getTime()).toBeGreaterThanOrEqual(before - days * 86_400_000)
    expect(start.getTime()).toBeLessThanOrEqual(after - days * 86_400_000)
  })

  it('queries the current window and the previous window separately', async () => {
    mockFindMany.mockResolvedValue([])

    await get('7d')

    const current = mockFindMany.mock.calls[0][0].where.createdAt
    const previous = mockFindMany.mock.calls[1][0].where.createdAt

    expect(current.lt).toBeUndefined()
    expect(previous.lt.getTime()).toBe(current.gte.getTime())
    expect(previous.gte.getTime()).toBe(current.gte.getTime() - 7 * 86_400_000)
  })

  it('computes growth against the previous window', async () => {
    let call = 0
    mockFindMany.mockImplementation((args: { select?: Record<string, unknown> }) => {
      const select = args.select ?? {}
      if ('deliveredAt' in select) return Promise.resolve([])
      call += 1
      if (call === 1) return Promise.resolve([log(), log(), log()]) // 3 current
      if (call === 2) return Promise.resolve([log(), log()]) // 2 previous
      return Promise.resolve([])
    })

    const body = await (await get()).json()

    expect(body.data.comparison.prevTotal).toBe(2)
    expect(body.data.comparison.growthRate).toBeCloseTo(50, 5)
    expect(body.data.comparison.deliveryGrowth).toBeCloseTo(50, 5)
  })

  it('never produces NaN or Infinity for growth with an empty previous window', async () => {
    let call = 0
    mockFindMany.mockImplementation((args: { select?: Record<string, unknown> }) => {
      const select = args.select ?? {}
      if ('deliveredAt' in select) return Promise.resolve([])
      call += 1
      return call === 1 ? Promise.resolve([log(), log()]) : Promise.resolve([])
    })

    const body = await (await get()).json()

    expect(body.data.comparison.growthRate).toBe(0)
    expect(body.data.comparison.deliveryGrowth).toBe(0)
  })

  it('never produces NaN for email rates with an empty email window', async () => {
    mockFindMany.mockResolvedValue([])

    const body = await (await get()).json()

    expect(Number.isNaN(body.data.emailStats.openRate)).toBe(false)
    expect(Number.isNaN(body.data.emailStats.clickRate)).toBe(false)
    expect(Number.isFinite(body.data.totals.deliveryRate)).toBe(true)
  })
})

describe('GET /api/admin/notifications/analytics — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await get()

    expect(res.status).toBe(401)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is not a moderator', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Forbidden — moderator access required'), { status: 403 }),
    )

    const res = await get()
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe('FORBIDDEN')
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/notifications/analytics — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue(MOD)
  })

  it('returns 500 without leaking the database error', async () => {
    mockFindMany.mockRejectedValue(new Error('statement timeout'))

    const res = await get()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('statement timeout')
  })
})
