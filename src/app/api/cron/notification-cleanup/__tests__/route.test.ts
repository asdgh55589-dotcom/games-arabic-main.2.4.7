/**
 * Tests for GET /api/cron/notification-cleanup
 *
 * الأهم هنا ليس "يعيد 200" بل إثبات(property) الحذف **محدود بالدفعات**:
 * `deleteMany` بلا حدّ على جدول ينمو بلا حدّ هو ما يقطع قاعدة الإنتاج. أي
 * اختبار يقبل استدعاءً واحداً لـ `deleteMany` بلا `id: { in: [...] }` هو
 * اختبار يمرّ على الكود الخطر.
 */

jest.mock('@/lib/db', () => ({
  db: {
    notificationLog: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    notificationJob: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cron-auth', () => ({
  requireCronAuth: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/infrastructure/observability/logger', () => ({
  notificationLogger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { NextRequest, NextResponse } from 'next/server'
import { NOTIFICATION_CONFIG } from '@/infrastructure/config/notification-config'
import { alertService } from '@/infrastructure/observability/alerts'
import { requireCronAuth } from '@/lib/cron-auth'
import { db } from '@/lib/db'
import { GET } from '../route'

const mockCronAuth = requireCronAuth as jest.Mock

const mockLogFindMany = db.notificationLog.findMany as jest.Mock
const mockLogDeleteMany = db.notificationLog.deleteMany as jest.Mock
const mockJobFindMany = db.notificationJob.findMany as jest.Mock
const mockJobDeleteMany = db.notificationJob.deleteMany as jest.Mock
const mockJobCount = db.notificationJob.count as jest.Mock

function makeReq(url = 'http://localhost/api/cron/notification-cleanup'): NextRequest {
  return new NextRequest(url)
}

/** ids(batchSize) → معرّفات لصفوف أقدم من الحد. */
function rows(n: number, prefix = 'id') {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }))
}

describe('GET /api/cron/notification-cleanup — auth', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCronAuth.mockResolvedValue(null)
    mockLogFindMany.mockResolvedValue([])
    mockLogDeleteMany.mockResolvedValue({ count: 0 })
    mockJobFindMany.mockResolvedValue([])
    mockJobDeleteMany.mockResolvedValue({ count: 0 })
    mockJobCount.mockResolvedValue(0)
    alertService.resetCooldowns()
  })

  it('returns 401 and touches no data without CRON_SECRET', async () => {
    const authErr = NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    mockCronAuth.mockResolvedValue(authErr)

    const res = await GET(makeReq())

    expect(res.status).toBe(401)
    expect(mockLogDeleteMany).not.toHaveBeenCalled()
    expect(mockJobDeleteMany).not.toHaveBeenCalled()
  })

  it('returns 501 when CRON_SECRET is not configured on the server', async () => {
    mockCronAuth.mockResolvedValue(NextResponse.json({ error: 'no secret' }, { status: 501 }))

    const res = await GET(makeReq())

    expect(res.status).toBe(501)
    expect(mockLogDeleteMany).not.toHaveBeenCalled()
  })

  it('runs the cleanup when auth passes', async () => {
    const res = await GET(makeReq())

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(mockLogFindMany).toHaveBeenCalled()
    expect(mockJobFindMany).toHaveBeenCalled()
  })
})

describe('GET /api/cron/notification-cleanup — retention config', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCronAuth.mockResolvedValue(null)
    mockLogFindMany.mockResolvedValue([])
    mockLogDeleteMany.mockResolvedValue({ count: 0 })
    mockJobFindMany.mockResolvedValue([])
    mockJobDeleteMany.mockResolvedValue({ count: 0 })
    mockJobCount.mockResolvedValue(0)
    alertService.resetCooldowns()
  })

  it('reads retentionDays/jobRetentionDays from NOTIFICATION_CONFIG.cleanup', async () => {
    const res = await GET(makeReq())
    const body = await res.json()

    expect(NOTIFICATION_CONFIG.cleanup.retentionDays).toBe(90)
    expect(NOTIFICATION_CONFIG.cleanup.jobRetentionDays).toBe(30)
    expect(body.retention).toEqual({ logDays: 90, jobDays: 30 })
  })

  it('applies a 90-day cutoff to notification logs', async () => {
    const before = Date.now()
    await GET(makeReq())
    const after = Date.now()

    const call = mockLogFindMany.mock.calls[0][0]
    const cutoff = (call.where as { createdAt: { lt: Date } }).createdAt.lt.getTime()

    expect(cutoff).toBeGreaterThanOrEqual(before - 90 * 86_400_000)
    expect(cutoff).toBeLessThanOrEqual(after - 90 * 86_400_000)
  })

  it('applies a 30-day cutoff to notification jobs', async () => {
    const before = Date.now()
    await GET(makeReq())
    const after = Date.now()

    const call = mockJobFindMany.mock.calls[0][0]
    const cutoff = (call.where as { updatedAt: { lt: Date } }).updatedAt.lt.getTime()

    expect(cutoff).toBeGreaterThanOrEqual(before - 30 * 86_400_000)
    expect(cutoff).toBeLessThanOrEqual(after - 30 * 86_400_000)
  })

  it('applies retention to dead_letter jobs too — no status exemption', async () => {
    await GET(makeReq())

    // الحذف يقرأ الصفوف بـ `updatedAt` فقط، بلا أي قيد على `status`:
    // مهام `dead_letter` تخضع للاحتفاظ نفسه (30 يوماً).
    const readWhere = mockJobFindMany.mock.calls[0][0].where
    expect(readWhere).toEqual({ updatedAt: { lt: expect.any(Date) } })
    expect(JSON.stringify(readWhere)).not.toContain('status')

    for (const call of mockJobDeleteMany.mock.calls) {
      const where = (call[0] as { where: Record<string, unknown> }).where
      expect(where).not.toHaveProperty('status')
    }
  })

  it('counts remaining dead_letter jobs after the retention sweep', async () => {
    mockJobDeleteMany.mockResolvedValue({ count: 4 })
    mockJobFindMany.mockResolvedValueOnce([{ id: 'job-1' }, { id: 'job-2' }, { id: 'job-3' }])
    mockJobCount.mockResolvedValueOnce(3).mockResolvedValueOnce(20).mockResolvedValueOnce(1)

    const res = await GET(makeReq())
    const data = await res.json()

    expect(data.deleted.notificationJobs.deleted).toBe(4)
    // العدّ يتم بعد الحذف: 3 = ما تبقى من الميتة بعد جرف الريتَينشن
    expect(mockJobCount).toHaveBeenNthCalledWith(1, { where: { status: 'dead_letter' } })
  })
})

describe('GET /api/cron/notification-cleanup — bounded batches', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCronAuth.mockResolvedValue(null)
    mockJobCount.mockResolvedValue(0)
    alertService.resetCooldowns()
  })

  it('deletes only by the ids it just read, never an unbounded range', async () => {
    mockLogFindMany.mockResolvedValue(rows(3))
    mockLogDeleteMany.mockResolvedValue({ count: 3 })
    mockJobFindMany.mockResolvedValue([])

    await GET(makeReq())

    expect(mockLogDeleteMany).toHaveBeenCalledTimes(1)
    const args = mockLogDeleteMany.mock.calls[0][0] as { where: { id: { in: string[] } } }
    expect(args.where).toEqual({ id: { in: ['id-0', 'id-1', 'id-2'] } })
    expect(args.where).not.toHaveProperty('createdAt')
  })

  it('reads ids first, so nothing is deleted that was not selected', async () => {
    const order: string[] = []
    mockLogFindMany.mockImplementation(() => {
      order.push('findMany')
      return Promise.resolve(rows(2))
    })
    mockLogDeleteMany.mockImplementation(() => {
      order.push('deleteMany')
      return Promise.resolve({ count: 2 })
    })
    mockJobFindMany.mockImplementation(() => {
      order.push('jobFindMany')
      return Promise.resolve([])
    })

    await GET(makeReq())

    expect(order.indexOf('findMany')).toBeLessThan(order.indexOf('deleteMany'))
  })

  it('never deletes more than the batch size in a single deleteMany call', async () => {
    mockLogFindMany.mockImplementation(() => Promise.resolve(rows(500)))
    mockLogDeleteMany.mockResolvedValue({ count: 500 })
    mockJobFindMany.mockResolvedValue([])

    await GET(makeReq())

    for (const call of mockLogDeleteMany.mock.calls) {
      const ids = (call[0] as { where: { id: { in: string[] } } }).where.id.in
      expect(ids.length).toBeLessThanOrEqual(500)
    }
  })

  it('keeps deleting in batches until fewer than a full batch remains', async () => {
    // 3 full batches (1500 rows) then a short batch (10 rows).
    let remaining = 1510
    mockLogFindMany.mockImplementation(() => {
      if (remaining <= 0) return Promise.resolve([])
      const take = Math.min(500, remaining)
      remaining -= take
      return Promise.resolve(rows(take))
    })
    mockLogDeleteMany.mockImplementation((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve({ count: args.where.id.in.length }),
    )
    mockJobFindMany.mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.deleted.notificationLogs.deleted).toBe(1510)
    expect(body.deleted.notificationLogs.batches).toBe(4)
    expect(body.deleted.notificationLogs.truncated).toBe(false)
  })

  it('stops at the batch ceiling and reports truncated instead of looping forever', async () => {
    // A table that never yields a short batch: every read returns a full 500.
    mockLogFindMany.mockResolvedValue(rows(500))
    mockLogDeleteMany.mockResolvedValue({ count: 500 })
    mockJobFindMany.mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()

    // MAX_BATCHES = 40 → never more than 40*500 rows in a single invocation.
    expect(body.deleted.notificationLogs.batches).toBe(40)
    expect(body.deleted.notificationLogs.truncated).toBe(true)
    expect(body.deleted.notificationLogs.deleted).toBe(40 * 500)
    expect(mockLogDeleteMany).toHaveBeenCalledTimes(40)
  })

  it('reports the batch cap in the response so an operator can see the backlog', async () => {
    mockLogFindMany.mockResolvedValue(rows(500))
    mockLogDeleteMany.mockResolvedValue({ count: 500 })
    mockJobFindMany.mockResolvedValue(rows(500))
    mockJobDeleteMany.mockResolvedValue({ count: 500 })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.deleted.notificationLogs.truncated).toBe(true)
    expect(body.deleted.notificationJobs.truncated).toBe(true)
  })

  it('sums only rows actually deleted across batches', async () => {
    // Simulates a concurrent deletion stealing 2 rows from the second batch.
    let call = 0
    mockLogFindMany.mockImplementation(() => {
      call += 1
      return Promise.resolve(call === 1 ? rows(500) : [])
    })
    mockLogDeleteMany.mockImplementation((args: { where: { id: { in: string[] } } }) =>
      Promise.resolve({ count: call === 1 ? args.where.id.in.length - 2 : 0 }),
    )
    mockJobFindMany.mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.deleted.notificationLogs.deleted).toBe(498)
  })

  it('stops early on a partial batch so a stuck loop cannot hang the cron', async () => {
    let call = 0
    mockLogFindMany.mockImplementation(() => {
      call += 1
      return Promise.resolve(call === 1 ? rows(500) : rows(500))
    })
    mockLogDeleteMany.mockResolvedValue({ count: 1 }) // partial forever
    mockJobFindMany.mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.deleted.notificationLogs.batches).toBe(1)
    expect(mockLogDeleteMany).toHaveBeenCalledTimes(1)
  })

  it('a no-op run performs zero deletes', async () => {
    mockLogFindMany.mockResolvedValue([])
    mockJobFindMany.mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockLogDeleteMany).not.toHaveBeenCalled()
    expect(mockJobDeleteMany).not.toHaveBeenCalled()
    expect(body.deleted.notificationLogs.deleted).toBe(0)
    expect(body.deleted.notificationJobs.deleted).toBe(0)
  })

  it('is idempotent: a second run over an already-clean table deletes nothing', async () => {
    mockLogFindMany.mockResolvedValueOnce(rows(3)).mockResolvedValue([])
    mockLogDeleteMany.mockResolvedValue({ count: 3 })
    mockJobFindMany.mockResolvedValue([])

    const first = await (await GET(makeReq())).json()
    const second = await (await GET(makeReq())).json()

    expect(first.deleted.notificationLogs.deleted).toBe(3)
    expect(second.deleted.notificationLogs.deleted).toBe(0)
  })
})

describe('GET /api/cron/notification-cleanup — alerting', () => {
  const fetchMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockCronAuth.mockResolvedValue(null)
    mockLogFindMany.mockResolvedValue([])
    mockLogDeleteMany.mockResolvedValue({ count: 0 })
    mockJobFindMany.mockResolvedValue([])
    mockJobDeleteMany.mockResolvedValue({ count: 0 })
    alertService.resetCooldowns()
    global.fetch = fetchMock as unknown as typeof fetch
    fetchMock.mockResolvedValue({ ok: true })
    delete process.env.ALERT_WEBHOOK_URL
  })

  /** count 호출 بالترتيب: dead_letter, windowTotal, windowFailed */
  function counts(deadLetter: number, total: number, failed: number) {
    mockJobCount
      .mockResolvedValueOnce(deadLetter)
      .mockResolvedValueOnce(total)
      .mockResolvedValueOnce(failed)
  }

  it('fires no alert on a healthy system', async () => {
    counts(0, 100, 0)

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.alertsFired).toEqual([])
    expect(body.health).toEqual({ deadLetterCount: 0, windowTotal: 100, windowFailed: 0 })
  })

  it('fires dead_letter_threshold when the dead-letter count crosses the threshold', async () => {
    counts(25, 100, 0)

    const body = await (await GET(makeReq())).json()

    expect(body.alertsFired).toContain('dead_letter_threshold')
  })

  it('fires drain_error_rate when the failure rate spikes', async () => {
    counts(0, 100, 90)

    const body = await (await GET(makeReq())).json()

    expect(body.alertsFired).toContain('drain_error_rate')
  })

  it('delivers the alert to ALERT_WEBHOOK_URL when configured', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/x'
    counts(25, 100, 90)

    await GET(makeReq())

    const alertCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('https://hooks.example.com'),
    )
    expect(alertCalls.length).toBeGreaterThanOrEqual(2)
    expect(JSON.parse(alertCalls[0][1].body)).toMatchObject({
      alert: 'dead_letter_threshold',
      severity: 'warning',
    })
  })

  it('never fails the cron when the alert webhook rejects', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.com/x'
    fetchMock.mockRejectedValue(new Error('webhook down'))
    counts(25, 100, 90)

    const res = await GET(makeReq())

    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('surfaces a 500 when the health read fails, so the failure is not silent', async () => {
    mockLogFindMany.mockResolvedValue([])
    mockLogDeleteMany.mockResolvedValue({ count: 0 })
    mockJobFindMany.mockResolvedValue([])
    mockJobDeleteMany.mockResolvedValue({ count: 0 })
    mockJobCount.mockRejectedValue(new Error('count timeout'))

    const res = await GET(makeReq())

    expect(res.status).toBe(500)
  })
})

describe('GET /api/cron/notification-cleanup — failure handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCronAuth.mockResolvedValue(null)
    alertService.resetCooldowns()
  })

  it('returns 500 when the deletion query fails', async () => {
    mockLogFindMany.mockRejectedValue(new Error('db down'))

    const res = await GET(makeReq())

    expect(res.status).toBe(500)
    expect((await res.json()).error).toBeDefined()
  })

  it('does not run the job cleanup when the log cleanup already failed', async () => {
    mockLogFindMany.mockRejectedValue(new Error('db down'))
    mockJobFindMany.mockResolvedValue([])

    await GET(makeReq())

    expect(mockJobFindMany).not.toHaveBeenCalled()
  })
})
