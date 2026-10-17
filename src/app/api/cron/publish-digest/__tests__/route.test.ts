/**
 * اختبارات /api/cron/publish-digest (مرحلة 6): idempotency عبر claimRun،
 * جمع العدّادات على النافذة المطلوبة (يومي/أسبوعي)، إرسال PublishDigest
 * لكل مدير محتوى، وfailRun عند الخطأ.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPostDelivery: { count: jest.fn() },
    socialPost: { count: jest.fn() },
    publishErrorEvent: { count: jest.fn() },
  },
}))

jest.mock('@/lib/cron-auth', () => ({ requireCronAuth: jest.fn().mockResolvedValue(null) }))

jest.mock('@/lib/cron-ledger', () => ({
  claimRun: jest.fn().mockResolvedValue({ alreadyRan: false, jobId: 'ledger-1' }),
  completeRun: jest.fn().mockResolvedValue(undefined),
  failRun: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/social/publish-error-events', () => ({
  contentManagers: jest.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]),
  sendToService: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { db } from '@/lib/db'
import { contentManagers, sendToService } from '@/lib/social/publish-error-events'
import { GET } from '../route'

const mockAuth = requireCronAuth as jest.Mock
const mockClaim = claimRun as jest.Mock
const mockComplete = completeRun as jest.Mock
const mockFail = failRun as jest.Mock
const mockDb = db as unknown as {
  socialPostDelivery: { count: jest.Mock }
  socialPost: { count: jest.Mock }
  publishErrorEvent: { count: jest.Mock }
}
const mockManagers = contentManagers as jest.Mock
const mockSend = sendToService as jest.Mock

const makeReq = (qs = '') => new NextRequest(`http://localhost/api/cron/publish-digest${qs}`)

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue(null)
  mockClaim.mockResolvedValue({ alreadyRan: false, jobId: 'ledger-1' })
  // الترتيب في المسار: delivered ثم failed (delivery×2)، ثم archived (post)، openErrors.
  mockDb.socialPostDelivery.count
    .mockResolvedValueOnce(12)
    .mockResolvedValueOnce(2)
    .mockResolvedValue(0)
  mockDb.socialPost.count.mockResolvedValue(1)
  mockDb.publishErrorEvent.count.mockResolvedValue(3)
  mockManagers.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }])
  mockSend.mockResolvedValue(undefined)
})

describe('cron/publish-digest — المصادقة وidempotency', () => {
  it('يرفض بلا CRON_SECRET ولا يلمس أي شيء', async () => {
    mockAuth.mockResolvedValue(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))

    const res = await GET(makeReq())

    expect(res.status).toBe(401)
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockDb.socialPostDelivery.count).not.toHaveBeenCalled()
  })

  it('نافذة مكررة → skipped=duplicate بلا عدّ ولا إرسال', async () => {
    mockClaim.mockResolvedValue({ alreadyRan: true, jobId: null })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipped).toBe('duplicate')
    expect(mockDb.publishErrorEvent.count).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('اسم الوظيفة مقيّد بالنوع: publish-digest:daily', async () => {
    await GET(makeReq('?type=daily'))
    const [jobName] = mockClaim.mock.calls[0]
    expect(jobName).toBe('publish-digest:daily')
  })
})

describe('cron/publish-digest — العدّادات والإرسال', () => {
  it('التقرير اليومي يحمل العدّادات ويرسل لكل مدير', async () => {
    const res = await GET(makeReq('?type=daily'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.counts).toEqual({ delivered: 12, failed: 2, archived: 1, openErrors: 3 })
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'm1',
        type: 'PublishDigest',
        channels: ['InApp', 'Email'],
        templateVariables: expect.objectContaining({
          publishedCount: 12,
          failedCount: 2,
          archivedCount: 1,
          openErrors: 3,
          periodLabel: 'اليوم',
        }),
      }),
    )
    expect(mockComplete).toHaveBeenCalledWith('ledger-1')
  })

  it('weekly → فترة 7 أيام وperiodLabel الأسبوع الماضي', async () => {
    const res = await GET(makeReq('?type=weekly'))
    const body = await res.json()

    expect(body.counts).toEqual({ delivered: 12, failed: 2, archived: 1, openErrors: 3 })
    const vars = mockSend.mock.calls[0][0].templateVariables
    expect(vars.periodLabel).toBe('الأسبوع الماضي')
    // نافذة الإحصاء تمتد 7 أيام.
    const where = mockDb.socialPostDelivery.count.mock.calls[0][0].where.createdAt
    expect(where.lte.getTime() - where.gte.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('فشل db → 500 وfailRun وcomplete غير مستدعى', async () => {
    mockDb.publishErrorEvent.count.mockRejectedValue(new Error('db down'))

    const res = await GET(makeReq())

    expect(res.status).toBe(500)
    expect(mockFail).toHaveBeenCalledWith('ledger-1', expect.any(Error))
    expect(mockComplete).not.toHaveBeenCalled()
  })
})
