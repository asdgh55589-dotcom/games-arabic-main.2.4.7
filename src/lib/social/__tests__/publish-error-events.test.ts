/**
 * اختبارات مسجّل أخطاء النشر (مرحلة 6): دمج الأحداث المكررة (نافذة 30 د)،
 * تنبيه التدهور عند 3 أحداث مفتوحة (تمهيد notifiedAt مرة واحدة + إشعار
 * المدراء)، الحل اليدوي/التلقائي، وقناع التوكنات في sanitizeMessage.
 */

jest.mock('@/lib/db', () => ({
  db: {
    publishErrorEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    user: { findMany: jest.fn() },
    socialPost: { findUnique: jest.fn() },
  },
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { db } from '@/lib/db'
import {
  contentManagers,
  DEGRADATION_THRESHOLD,
  notifyPublishSuccess,
  recordPublishError,
  resolveEventManually,
  resolvePublishErrorsOpen,
  sanitizeMessage,
} from '../publish-error-events'

const mockDb = db as unknown as {
  publishErrorEvent: {
    findFirst: jest.Mock
    create: jest.Mock
    count: jest.Mock
    updateMany: jest.Mock
    groupBy: jest.Mock
  }
  user: { findMany: jest.Mock }
  socialPost: { findUnique: jest.Mock }
}

const def = (over: Record<string, unknown> = {}) => ({
  code: 'rate_limited',
  scope: 'post' as const,
  refId: 'post-1',
  message: 'boom',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.publishErrorEvent.findFirst.mockResolvedValue(null)
  mockDb.publishErrorEvent.create.mockResolvedValue({ id: 'ev-1' })
  mockDb.publishErrorEvent.count.mockResolvedValue(1)
  mockDb.publishErrorEvent.updateMany.mockResolvedValue({ count: 1 })
  mockDb.publishErrorEvent.groupBy.mockResolvedValue([])
  mockDb.user.findMany.mockResolvedValue([{ id: 'm1' }])
  mockDb.socialPost.findUnique.mockResolvedValue(null)
})

describe('recordPublishError — الدمج والتدهور', () => {
  it('حدث مكرّر مفتوح في النافذة → بلا صف جديد (alreadyOpen)', async () => {
    mockDb.publishErrorEvent.findFirst.mockResolvedValue({ id: 'ev-dup', notifiedAt: null })

    const out = await recordPublishError(def())

    expect(out).toEqual({ eventId: 'ev-dup', degraded: false, alreadyOpen: true })
    expect(mockDb.publishErrorEvent.create).not.toHaveBeenCalled()
  })

  it('عدّاد مفتوح تحت العتبة → بلا تحكّم تنبيه', async () => {
    const out = await recordPublishError(def())

    expect(out.degraded).toBe(false)
    expect(mockDb.publishErrorEvent.updateMany).not.toHaveBeenCalled()
    expect(mockDb.user.findMany).not.toHaveBeenCalled()
  })

  it('بلوغ العتبة → ختم notifiedAt على أحداث الجدولة + إشعار المدراء', async () => {
    expect(DEGRADATION_THRESHOLD).toBe(3)
    mockDb.publishErrorEvent.count.mockResolvedValue(3)

    const out = await recordPublishError(def())

    expect(out.degraded).toBe(true)
    // ختم alerted: فقط الأحداث المفتوحة غير المبلغ عنها (notifiedAt: null).
    expect(mockDb.publishErrorEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scope: 'post', refId: 'post-1', notifiedAt: null }),
      }),
    )
    expect(mockDb.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: ['moderator', 'manager', 'admin', 'owner'] },
        }),
      }),
    )
  })

  it('الكتابة البطيئة/المكسورة → نتية محايدة ورميتها سجل *لا* انفجار', async () => {
    mockDb.publishErrorEvent.create.mockRejectedValue(new Error('db down'))

    const out = await recordPublishError(def())

    expect(out).toEqual({ eventId: null, degraded: false, alreadyOpen: false })
  })
})

describe('resolveEventManually / resolvePublishErrorsOpen', () => {
  it('حدث غير محلول → حل مع تدقيق؛ already=true إذا كان محلولاً', async () => {
    mockDb.publishErrorEvent.updateMany.mockResolvedValueOnce({ count: 1 })

    const okOut = await resolveEventManually('ev-1', { id: 'a1', username: 'boss' })
    expect(okOut).toEqual({ ok: true })

    mockDb.publishErrorEvent.updateMany.mockResolvedValueOnce({ count: 0 })
    const dup = await resolveEventManually('ev-1', { id: 'a1' })
    expect(dup).toEqual({ ok: false, already: true })
  })

  it('الحل التلقائي يمرّ نطاق/مرجع الحقول (bola resolvedBy null تلقائياً)', async () => {
    const total = await resolvePublishErrorsOpen([
      { scope: 'post', refId: 'post-1' },
      { scope: 'bot', refId: null },
    ])

    expect(total).toBe(2)
    const first = mockDb.publishErrorEvent.updateMany.mock.calls[0][0]
    expect(first.where).toEqual({ scope: 'post', refId: 'post-1', resolvedAt: null })
    expect(first.data.resolvedBy).toBeUndefined()
  })
})

describe('sanitizeMessage + notifyPublishSuccess', () => {
  it('يُقنّع توكن البوت وBearer قبل الحفظ', () => {
    const raw =
      'POST https://api.telegram.org/bot1234567890:AAAAAAAAAA-tok/sendMessage failed; auth=Bearer sk-live-xyz'
    const out = sanitizeMessage(raw)
    expect(out).not.toContain('1234567890:')
    expect(out).not.toContain('AAAAA')
    expect(out).not.toMatch(/Bearer\s+\S+/i)
    expect(out).toContain('توكن-مُقنَّع')
  })

  it('نجاح بلا مؤلف → بلا إشعار إطلاقاً', async () => {
    await notifyPublishSuccess({ postId: 'post-1', authorId: null })
    expect(mockDb.socialPost.findUnique).not.toHaveBeenCalled()
  })

  it('مدراء المحتوى يفشلون بسلام (بلا دور → None)', async () => {
    mockDb.user.findMany.mockRejectedValue(new Error('db down'))
    await expect(contentManagers()).resolves.toEqual([])
  })
})
