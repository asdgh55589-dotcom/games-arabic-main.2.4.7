/**
 * Tests for /api/admin/scheduler — CRUD للمهام المجدولة.
 *
 * أربعة معالجات في مسار واحد: GET (قائمة + إحصاءات)، POST (إنشاء)،
 * PATCH (تعديل)، DELETE (إلغاء). يغطّي كلٌّ منها المسار السعيد وفشل المصادقة
 * وفشل التحقق.
 *
 * ملاحظة: `requireAdmin` يمرّ بـ `try/catch` بلا فحص `status`، فكل خطأ مصادقة
 * يصل كـ 500. السلوك موثّق كما هو.
 */

jest.mock('@/lib/db', () => ({
  db: {
    scheduledJob: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth', () => ({
  requireAdmin: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { DELETE, GET, PATCH, POST } from '../route'

const mockRequireAdmin = requireAdmin as jest.Mock
const mockFindMany = db.scheduledJob.findMany as jest.Mock
const mockFindUnique = db.scheduledJob.findUnique as jest.Mock
const mockCount = db.scheduledJob.count as jest.Mock
const mockGroupBy = db.scheduledJob.groupBy as jest.Mock
const mockCreate = db.scheduledJob.create as jest.Mock
const mockUpdate = db.scheduledJob.update as jest.Mock

const ADMIN = { id: 'admin-1', role: 'admin', username: 'root' }

function futureIso(offsetMs = 3_600_000) {
  return new Date(Date.now() + offsetMs).toISOString()
}

function req(url: string, method = 'GET', body?: unknown): NextRequest {
  const init: Record<string, unknown> = { method }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  return new NextRequest(url, init as never)
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    type: 'publish_mod',
    status: 'pending',
    modId: 'mod-1',
    scheduledAt: new Date('2026-05-01T00:00:00.000Z'),
    payload: {},
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
    mod: { id: 'mod-1', name: 'لعبة', slug: 'game' },
    ...overrides,
  }
}

describe('GET /api/admin/scheduler — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockFindMany.mockResolvedValue([job()])
    mockCount.mockResolvedValue(1)
    mockGroupBy.mockResolvedValue([{ status: 'pending', _count: { id: 3 } }])
  })

  it('returns the job list with pagination and status stats', async () => {
    const res = await GET(req('http://localhost/api/admin/scheduler'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.jobs).toHaveLength(1)
    expect(body.data.pagination).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 })
    expect(body.data.stats).toEqual({ pending: 3 })
  })

  it('applies status and type filters', async () => {
    await GET(req('http://localhost/api/admin/scheduler?status=pending&type=publish_mod'))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending', type: 'publish_mod' } }),
    )
    expect(mockCount).toHaveBeenCalledWith({ where: { status: 'pending', type: 'publish_mod' } })
  })

  it('orders by scheduledAt descending and includes the mod', async () => {
    await GET(req('http://localhost/api/admin/scheduler'))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scheduledAt: 'desc' },
        include: { mod: { select: { id: true, name: true, slug: true } } },
      }),
    )
  })

  it('computes skip/take from the page and limit', async () => {
    await GET(req('http://localhost/api/admin/scheduler?page=4&limit=10'))

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 30, take: 10 }))
  })

  it('reports totalPages as 0 when there are no jobs', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockGroupBy.mockResolvedValue([])

    const body = await (await GET(req('http://localhost/api/admin/scheduler'))).json()

    expect(body.data.pagination.totalPages).toBe(0)
    expect(body.data.stats).toEqual({})
  })
})

describe('POST /api/admin/scheduler — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockCreate.mockResolvedValue(job())
  })

  it('creates a job scheduled in the future', async () => {
    const res = await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'publish_mod',
        modId: 'mod-1',
        scheduledAt: futureIso(),
        payload: { locale: 'ar' },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        type: 'publish_mod',
        modId: 'mod-1',
        scheduledAt: expect.any(Date),
        payload: { locale: 'ar' },
      },
    })
  })

  it('accepts a job with no mod attached', async () => {
    await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'cleanup',
        scheduledAt: futureIso(),
      }),
    )

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ modId: null, payload: {} }) }),
    )
  })
})

describe('POST /api/admin/scheduler — validation failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
  })

  it.each([
    ['missing type', { scheduledAt: futureIso() }],
    ['missing scheduledAt', { type: 'publish_mod' }],
    ['empty body', {}],
    ['null scheduledAt', { type: 'publish_mod', scheduledAt: null }],
  ])('rejects %s with 422', async (_label, body) => {
    const res = await POST(req('http://localhost/api/admin/scheduler', 'POST', body))
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejects a past schedule time', async () => {
    const res = await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'publish_mod',
        scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    )

    expect(res.status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('rejects "now" as a schedule time', async () => {
    const res = await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'publish_mod',
        scheduledAt: new Date().toISOString(),
      }),
    )

    expect(res.status).toBe(422)
  })

  it('does NOT reject an unparseable date at validation time — known gap', async () => {
    // `new Date('not-a-date')` = Invalid Date، ومقارنة Invalid Date <= now
    // تُرجع false، فيمرّ الفحص. النتيجة في الإنتاج 500 من Prisma لا 422.
    // موثّق كما هو السلوك، لا مُغطّى كتغطية للسلوك الصحيح.
    mockCreate.mockResolvedValue(job())

    const res = await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'publish_mod',
        scheduledAt: 'not-a-date',
      }),
    )

    expect(res.status).toBe(200)
    const scheduledAt = (mockCreate.mock.calls[0][0] as { data: { scheduledAt: Date } }).data
      .scheduledAt
    expect(Number.isNaN(scheduledAt.getTime())).toBe(true)
  })
})

describe('PATCH /api/admin/scheduler — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockFindUnique.mockResolvedValue(job())
    mockUpdate.mockResolvedValue(job({ status: 'failed' }))
  })

  it('updates a pending job', async () => {
    const res = await PATCH(
      req('http://localhost/api/admin/scheduler', 'PATCH', {
        id: 'job-1',
        scheduledAt: futureIso(),
        payload: { locale: 'ar' },
      }),
    )

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { scheduledAt: expect.any(Date), payload: { locale: 'ar' } },
    })
  })

  it('allows changing the status of a pending job', async () => {
    await PATCH(
      req('http://localhost/api/admin/scheduler', 'PATCH', { id: 'job-1', status: 'failed' }),
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'failed' },
    })
  })

  it('omits absent fields from the update', async () => {
    await PATCH(req('http://localhost/api/admin/scheduler', 'PATCH', { id: 'job-1' }))

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'job-1' }, data: {} })
  })

  it('allows editing a non-pending job when it is marked failed', async () => {
    mockFindUnique.mockResolvedValue(job({ status: 'running' }))

    const res = await PATCH(
      req('http://localhost/api/admin/scheduler', 'PATCH', {
        id: 'job-1',
        status: 'failed',
        payload: { note: 'operator stop' },
      }),
    )

    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/scheduler — validation failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockFindUnique.mockResolvedValue(job())
  })

  it('rejects a missing id with 422', async () => {
    const res = await PATCH(
      req('http://localhost/api/admin/scheduler', 'PATCH', { status: 'failed' }),
    )

    expect(res.status).toBe(422)
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown id', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await PATCH(
      req('http://localhost/api/admin/scheduler', 'PATCH', { id: 'ghost', status: 'failed' }),
    )
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it.each(['running', 'completed', 'sent'])(
    'refuses to edit a %s job when no status is supplied',
    async (status) => {
      mockFindUnique.mockResolvedValue(job({ status }))

      const res = await PATCH(
        req('http://localhost/api/admin/scheduler', 'PATCH', { id: 'job-1', payload: { a: 1 } }),
      )

      expect(res.status).toBe(422)
      expect(mockUpdate).not.toHaveBeenCalled()
    },
  )
})

describe('DELETE /api/admin/scheduler — happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockFindUnique.mockResolvedValue(job())
    mockUpdate.mockResolvedValue(job({ status: 'failed' }))
  })

  it('cancels a pending job by marking it failed', async () => {
    const res = await DELETE(req('http://localhost/api/admin/scheduler?id=job-1', 'DELETE'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual({ cancelled: true })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'failed', error: 'Cancelled by admin' },
    })
  })
})

describe('DELETE /api/admin/scheduler — validation failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
    mockFindUnique.mockResolvedValue(job())
  })

  it('rejects a missing id with 422', async () => {
    const res = await DELETE(req('http://localhost/api/admin/scheduler', 'DELETE'))

    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown id', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await DELETE(req('http://localhost/api/admin/scheduler?id=ghost', 'DELETE'))

    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('refuses to cancel a job that is not pending', async () => {
    mockFindUnique.mockResolvedValue(job({ status: 'completed' }))

    const res = await DELETE(req('http://localhost/api/admin/scheduler?id=job-1', 'DELETE'))

    expect(res.status).toBe(422)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('/api/admin/scheduler — auth failure', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
    mockGroupBy.mockResolvedValue([])
  })

  it.each([
    ['GET', () => GET(req('http://localhost/api/admin/scheduler'))],
    ['POST', () => POST(req('http://localhost/api/admin/scheduler', 'POST', { type: 'x' }))],
    ['PATCH', () => PATCH(req('http://localhost/api/admin/scheduler', 'PATCH', { id: 'x' }))],
    ['DELETE', () => DELETE(req('http://localhost/api/admin/scheduler?id=x', 'DELETE'))],
  ])('%s returns 500 (not 401/403) when the caller is not an admin', async (_label, run) => {
    // catch لا يفحص `status` — 500 هو السلوك الفعلي، موثّق لا مُغطّى.
    mockRequireAdmin.mockRejectedValue(
      Object.assign(new Error('Forbidden — admin access required'), { status: 403 }),
    )

    const res = await run()

    expect(res.status).toBe(500)
    expect(mockFindMany).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('/api/admin/scheduler — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdmin.mockResolvedValue(ADMIN)
  })

  it('returns 500 without leaking the database error from the list query', async () => {
    mockFindMany.mockRejectedValue(new Error('too many connections'))

    const res = await GET(req('http://localhost/api/admin/scheduler'))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(JSON.stringify(json)).not.toContain('too many connections')
  })

  it('returns 500 when the create fails', async () => {
    mockCreate.mockRejectedValue(new Error('foreign key violation'))

    const res = await POST(
      req('http://localhost/api/admin/scheduler', 'POST', {
        type: 'publish_mod',
        scheduledAt: futureIso(),
      }),
    )

    expect(res.status).toBe(500)
  })

  it('returns 500 for a malformed JSON body on PATCH', async () => {
    const res = await PATCH(
      new NextRequest('http://localhost/api/admin/scheduler', {
        method: 'PATCH',
        body: '{{{',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    expect(res.status).toBe(500)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
