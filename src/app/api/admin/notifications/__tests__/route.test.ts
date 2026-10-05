/**
 * Tests for GET /api/admin/notifications — سجل الإشعارات (list).
 *
 * غلاف على `requireModerator` + ترقيم صفحات + مرشّحات. الأهم هنا أن استجابة
 * القائمة تُظهر `total` و `totalPages` truthfully: صفحة السجل تعرض هذه
 * الأرقام كمصدر وحيد لعدد الصفحات.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationLog: {
      findMany: jest.fn(),
      count: jest.fn(),
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
const mockCount = db.notificationLog.count as jest.Mock

function makeLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    channel: 'in_app',
    status: 'sent',
    createdAt: new Date('2026-02-03T00:00:00.000Z'),
    notification: {
      type: 'like',
      title: 'إعجاب',
      user: { id: 'u1', username: 'ali', displayName: 'علي' },
    },
    ...overrides,
  }
}

function get(url = 'http://localhost/api/admin/notifications') {
  return GET(new NextRequest(url))
}

describe('GET /api/admin/notifications — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue({ id: 'mod-1', role: 'moderator', username: 'mod' })
    mockFindMany.mockResolvedValue([makeLog()])
    mockCount.mockResolvedValue(1)
  })

  it('returns the logs and truthful pagination', async () => {
    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.logs).toHaveLength(1)
    expect(body.data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
  })

  it('never reports totalPages: 0 for an empty table', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const body = await (await get()).json()

    expect(body.data.logs).toEqual([])
    expect(body.data.pagination.totalPages).toBe(1)
  })

  it('computes totalPages from the real total, not the page length', async () => {
    mockFindMany.mockResolvedValue([makeLog()])
    mockCount.mockResolvedValue(95)

    const body = await (
      await get('http://localhost/api/admin/notifications?page=2&limit=20')
    ).json()

    expect(body.data.pagination).toMatchObject({ page: 2, limit: 20, total: 95, totalPages: 5 })
  })

  it('orders newest first and includes the recipient user', async () => {
    await get()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        include: {
          notification: {
            include: { user: { select: { id: true, username: true, displayName: true } } },
          },
        },
      }),
    )
  })

  it('computes skip/take from page and limit', async () => {
    await get('http://localhost/api/admin/notifications?page=3&limit=5')

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }))
  })

  it('applies channel/status/type filters', async () => {
    await get(
      'http://localhost/api/admin/notifications?channel=email&status=failed&type=comment_reply',
    )

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel: 'email', status: 'failed', notification: { type: 'comment_reply' } },
      }),
    )
    expect(mockCount).toHaveBeenCalledWith({
      where: { channel: 'email', status: 'failed', notification: { type: 'comment_reply' } },
    })
  })

  it('applies only the filters that were supplied', async () => {
    await get('http://localhost/api/admin/notifications?status=failed')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'failed' } }),
    )
  })

  it('uses an empty filter when nothing is supplied', async () => {
    await get()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })
})

describe('GET /api/admin/notifications — pagination input validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue({ id: 'mod-1', role: 'moderator', username: 'mod' })
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it.each([
    ['page=0', 1, 20],
    ['page=-5', 1, 20],
    ['page=abc', 1, 20],
    ['limit=5000', 1, 100],
    ['limit=abc', 1, 20],
    ['page=2&limit=101', 2, 100],
  ])('clamps %s to a usable page/limit', async (query, page, limit) => {
    const body = await (await get(`http://localhost/api/admin/notifications?${query}`)).json()

    expect(body.data.pagination.page).toBe(page)
    expect(body.data.pagination.limit).toBe(limit)
    expect(body.data.pagination.totalPages).toBeGreaterThanOrEqual(1)
  })

  it('treats limit=0 as "unspecified" (parseInt fallback) rather than a 0-row page', async () => {
    // `parseInt('0') || 20` → 20. مقصود: صفحة بحجم صفر تعني «لا أعرف».
    const body = await (await get('http://localhost/api/admin/notifications?limit=0')).json()

    expect(body.data.pagination.limit).toBe(20)
  })

  it('never queries with a negative skip, even for a negative page', async () => {
    await get('http://localhost/api/admin/notifications?page=-5&limit=10')

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }))
  })

  it('does not clamp an absurdly large page — it forwards a huge but non-negative skip', async () => {
    // ملاحظة سلوكية لا خطأ: لا يوجد حدّ أعلى للصفحة، فـ skip يمرّ كما هو إلى
    // Prisma. Postgres يقبل OFFSET كبيراً ويعيد صفوفاً فارغة، فلا انهيار —
    // لكنه يمرّر قيمة بلا سقف إلى الاستعلام. مُوثّق للعلم، لا لتغيير السلوك هنا.
    const body = await (
      await get('http://localhost/api/admin/notifications?page=99999999999&limit=20')
    ).json()

    expect(body.data.pagination.page).toBe(99_999_999_999)
    const skip = mockFindMany.mock.calls[0][0].skip
    expect(skip).toBeGreaterThanOrEqual(0)
  })
})

describe('GET /api/admin/notifications — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it('returns 401 when the caller is not signed in', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { status: 401 }),
    )

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('returns 403 when the caller is signed in but not a moderator', async () => {
    mockRequireModerator.mockRejectedValue(
      Object.assign(new Error('Forbidden — moderator access required'), { status: 403 }),
    )

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCount).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/notifications — unexpected failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireModerator.mockResolvedValue({ id: 'mod-1', role: 'moderator', username: 'mod' })
  })

  it('returns 500 without leaking the database error', async () => {
    mockFindMany.mockRejectedValue(new Error('connection to Aiven refused'))

    const res = await get()
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(body)).not.toContain('Aiven')
  })
})
