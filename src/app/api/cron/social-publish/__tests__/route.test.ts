/**
 * اختبارات /api/cron/social-publish (W1/A5).
 *
 * يُثبت ثلاثة عقود ليست "يعيد 200":
 *  1) idempotency: تشغيل ثانٍ في نافذة الدقيقة نفسها → skipped/duplicate بلا قراءة.
 *  2) التفريغ المزدوج: منشورات Social Hub المستحقة + المهام القديمة telegram_post.
 *  3) حدود الدفعات + تنظيف السجل + ledger (complete/fail).
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPost: { findMany: jest.fn() },
    scheduledJob: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/cron-auth', () => ({ requireCronAuth: jest.fn().mockResolvedValue(null) }))

jest.mock('@/lib/cron-ledger', () => ({
  claimRun: jest.fn(),
  completeRun: jest.fn().mockResolvedValue(undefined),
  failRun: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/scheduler', () => ({ executeJob: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/lib/social/publish', () => ({ publishSocialPost: jest.fn() }))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { NextRequest, NextResponse } from 'next/server'
import { requireCronAuth } from '@/lib/cron-auth'
import { claimRun, completeRun, failRun } from '@/lib/cron-ledger'
import { db } from '@/lib/db'
import { executeJob } from '@/lib/scheduler'
import { publishSocialPost } from '@/lib/social/publish'
import { GET } from '../route'

const mockAuth = requireCronAuth as jest.Mock
const mockClaim = claimRun as jest.Mock
const mockComplete = completeRun as jest.Mock
const mockFail = failRun as jest.Mock
const mockExecute = executeJob as jest.Mock
const mockPublish = publishSocialPost as jest.Mock
const mockDb = db as unknown as {
  socialPost: { findMany: jest.Mock }
  scheduledJob: { deleteMany: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock }
}

const makeReq = () => new NextRequest('http://localhost/api/cron/social-publish')

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.mockResolvedValue(null)
  mockClaim.mockResolvedValue({ alreadyRan: false, jobId: 'ledger-1' })
  mockDb.scheduledJob.deleteMany.mockResolvedValue({ count: 0 })
  mockDb.socialPost.findMany.mockResolvedValue([])
  mockDb.scheduledJob.findMany.mockResolvedValue([])
  mockDb.scheduledJob.findUnique.mockResolvedValue({ status: 'completed' })
  mockPublish.mockResolvedValue({ ok: true, status: 'published', externalId: 'tg-1' })
})

describe('cron/social-publish — المصادقة', () => {
  it('يرفض بلا CRON_SECRET ولا يلمس أي بيانات', async () => {
    mockAuth.mockResolvedValue(NextResponse.json({ error: 'unauthorized' }, { status: 401 }))

    const res = await GET(makeReq())

    expect(res.status).toBe(401)
    expect(mockClaim).not.toHaveBeenCalled()
    expect(mockDb.socialPost.findMany).not.toHaveBeenCalled()
  })
})

describe('cron/social-publish — idempotency', () => {
  it('تشغيل مكرّر في نفس نافذة الدقيقة → skipped وبلا تفريغ', async () => {
    mockClaim.mockResolvedValue({ alreadyRan: true, jobId: null })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.skipped).toBe('duplicate')
    expect(body.window).toBeTruthy()
    expect(mockDb.socialPost.findMany).not.toHaveBeenCalled()
    expect(mockPublish).not.toHaveBeenCalled()
  })

  it('اسم الوظيفة مقيّد بنافذة الدقيقة (social-publish:<YYYY-MM-DDTHH:mm>)', async () => {
    await GET(makeReq())
    const [jobName] = mockClaim.mock.calls[0]
    expect(jobName).toMatch(/^social-publish:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})

describe('cron/social-publish — التفريغ المزدوج', () => {
  it('ينشر منشورات Social Hub المستحقة ويسجّل العدّاد', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])
    mockPublish
      .mockResolvedValueOnce({ ok: true, status: 'published', externalId: 'tg-1' })
      .mockResolvedValueOnce({ ok: true, status: 'skipped', reason: 'already_published' })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockPublish).toHaveBeenCalledWith('p1', { source: 'cron' })
    expect(mockPublish).toHaveBeenCalledWith('p2', { source: 'cron' })
    expect(body.data.published).toBe(1)
    expect(body.data.skipped).toBe(1)
    expect(body.data.due).toBe(2)
  })

  it('قراءة المنشورات المستحقة مقيّدة بـ status/سقف الدفعة/الوقت', async () => {
    await GET(makeReq())
    const arg = mockDb.socialPost.findMany.mock.calls[0][0]
    expect(arg.where).toMatchObject({ platform: 'telegram', status: 'scheduled' })
    expect(arg.where.scheduledFor.lte).toBeInstanceOf(Date)
    expect(arg.take).toBe(50)
  })

  it('يشغّل المهام القديمة telegram_post ثم يقرأ حالتها', async () => {
    mockDb.scheduledJob.findMany.mockResolvedValue([{ id: 'legacy-1' }])
    mockDb.scheduledJob.findUnique.mockResolvedValue({ status: 'completed' })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(mockExecute).toHaveBeenCalledWith('legacy-1')
    expect(body.data.legacy).toEqual({ executed: 1, failed: 0, found: 1 })
  })

  it('مهمة قديمة تبقى pending → تُعدّ فاشلة', async () => {
    mockDb.scheduledJob.findMany.mockResolvedValue([{ id: 'legacy-1' }])
    mockDb.scheduledJob.findUnique.mockResolvedValue({ status: 'pending' })

    const body = await (await GET(makeReq())).json()

    expect(body.data.legacy).toEqual({ executed: 0, failed: 1, found: 1 })
  })
})

describe('cron/social-publish — التنظيف والـ ledger', () => {
  it('ينظّف صفوف social-publish:* الأقدم من 7 أيام', async () => {
    const before = Date.now()
    await GET(makeReq())
    const after = Date.now()

    const arg = mockDb.scheduledJob.deleteMany.mock.calls[0][0]
    expect(arg.where.type).toEqual({ startsWith: 'social-publish:' })
    const cutoff = arg.where.createdAt.lt.getTime()
    expect(cutoff).toBeGreaterThanOrEqual(before - 7 * 86_400_000)
    expect(cutoff).toBeLessThanOrEqual(after - 7 * 86_400_000)
  })

  it('يُكمل السجل عند نجاح النشر', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([{ id: 'p1' }])
    mockPublish.mockResolvedValue({ ok: true, status: 'published', externalId: 'tg-1' })

    await GET(makeReq())

    expect(mockComplete).toHaveBeenCalledWith('ledger-1')
    expect(mockFail).not.toHaveBeenCalled()
  })

  it('يسجّل فشلاً في السجل حين يفشل كل شيء', async () => {
    mockDb.socialPost.findMany.mockResolvedValue([{ id: 'p1' }])
    mockPublish.mockResolvedValue({ ok: false, status: 'failed', error: 'boom' })

    const res = await GET(makeReq())
    const body = await res.json()

    expect(body.data.failed).toBe(1)
    expect(mockFail).toHaveBeenCalled()
    expect(mockComplete).not.toHaveBeenCalled()
  })

  it('فشل القراءة → 500 و failRun', async () => {
    mockDb.socialPost.findMany.mockRejectedValue(new Error('db down'))

    const res = await GET(makeReq())

    expect(res.status).toBe(500)
    expect(mockFail).toHaveBeenCalled()
  })
})
