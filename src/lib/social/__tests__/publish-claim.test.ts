/**
 * اختبارات انحدار للمطالبة الذرّية في publishSocialPost (المرحلة 0).
 *
 * تُثبت أن ناشرين متوازيين لنفس المنشور لا يرسلان مرتين:
 * المطالبة `updateMany` مشروط واحد إلى `publishing`، وعدّاد الصفوف
 * هو الحَكَم — الخاسر يُتخطى (`in_progress`) دون أي إرسال.
 */

jest.mock('@/lib/db', () => ({
  db: {
    socialPost: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    // الخلود (Phase 5): النشر لا يقرأ القالب أبداً (لقطة المحتوى تُلتقط عند
    // الحفظ/الجدولة). أي قراءة قالب من مسار النشر تُفجّر الاختبار.
    socialPostTemplate: {
      findUnique: jest.fn(() => {
        throw new Error('publish must not re-read the template (snapshot at save time)')
      }),
      findFirst: jest.fn(() => {
        throw new Error('publish must not re-read the template (snapshot at save time)')
      }),
    },
  },
}))

jest.mock('@/lib/social/telegram-send', () => ({
  sendTelegramPost: jest.fn(),
}))

// tg-rich-messages حزمة ESM خالصة لا يحلّها Jest/CJS — تُحاكى هنا كما في
// اختبارات المسارات (الاختبار يستخدم richDocument=null أصلاً).
jest.mock('@/lib/social/rich-post', () => ({
  isRichPostSpec: jest.fn(() => false),
  toRichMessageInput: jest.fn(),
}))

jest.mock('@/lib/social/validate-post', () => ({
  validateSocialPost: jest.fn(() => ({
    ok: true,
    issues: [],
    preview: { text: 'hello', parseMode: null, photo: null },
  })),
}))

// مرحلة 6: مسجّل أخطاء النشر مُحاكاة — هذه الاختبارات تُثبت المطالبة/الانحدار
// وليس كتالوج الأحداث (اختباراته منفصلة).
jest.mock('@/lib/social/publish-error-events', () => ({
  recordPublishError: jest
    .fn()
    .mockResolvedValue({ eventId: null, degraded: false, alreadyOpen: false }),
  resolvePublishErrorsOpen: jest.fn().mockResolvedValue(0),
  notifyPublishFailure: jest.fn().mockResolvedValue(undefined),
  notifyPublishSuccess: jest.fn().mockResolvedValue(undefined),
  alertDegraded: jest.fn().mockResolvedValue(undefined),
  contentManagers: jest.fn().mockResolvedValue([]),
  sendToService: jest.fn().mockResolvedValue(undefined),
  getDegradedEntities: jest.fn().mockResolvedValue([]),
  resolveEventManually: jest.fn().mockResolvedValue({ ok: true }),
}))

jest.mock('@/lib/audit', () => ({ logAction: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { db } from '@/lib/db'
import { sendTelegramPost } from '@/lib/social/telegram-send'
import { publishSocialPost } from '../publish'

const mockDb = db as unknown as {
  socialPost: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock }
}
const mockSend = sendTelegramPost as jest.Mock

const scheduledRow = {
  id: 'p1',
  platform: 'telegram',
  status: 'scheduled',
  title: null,
  body: 'hello',
  parseMode: null,
  richDocument: null,
  mediaUrl: null,
  destinationId: null,
  botId: null,
  externalId: null,
  attempts: 0,
  maxAttempts: 3,
  scheduledFor: new Date(),
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.TELEGRAM_CHANNEL_ID = '@test-channel'
  mockDb.socialPost.update.mockResolvedValue({})
  mockSend.mockResolvedValue({ ok: true, method: 'sendMessage', messageId: 123 })
})

describe('publishSocialPost — المطالبة الذرّية', () => {
  it('ناشران متوازيان → إرسال واحد فقط والثاني skipped/in_progress', async () => {
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ ...scheduledRow })
      .mockResolvedValueOnce({ ...scheduledRow })
      // إعادة القراءة بعد خسارة المطالبة: الصف محجوز وحديث.
      .mockResolvedValueOnce({ status: 'publishing', externalId: null })
    // الأول يظفر بالصف، الثاني يجده محجوزاً.
    mockDb.socialPost.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    const [a, b] = await Promise.all([
      publishSocialPost('p1', { source: 'cron' }),
      publishSocialPost('p1', { source: 'cron' }),
    ])

    expect(mockSend).toHaveBeenCalledTimes(1)
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['published', 'skipped'])
    const loser = a.status === 'skipped' ? a : b
    expect(loser.reason).toBe('in_progress')
  })

  it('المطالبة updateMany واحد مشروط إلى publishing (لا قراءة-ثم-كتابة)', async () => {
    mockDb.socialPost.findUnique.mockResolvedValue({ ...scheduledRow })
    mockDb.socialPost.updateMany.mockResolvedValue({ count: 1 })

    const result = await publishSocialPost('p1', { source: 'cron' })

    expect(result.status).toBe('published')
    expect(mockDb.socialPost.updateMany).toHaveBeenCalledTimes(1)
    const arg = mockDb.socialPost.updateMany.mock.calls[0][0]
    expect(arg).toMatchObject({ where: { id: 'p1' }, data: { status: 'publishing' } })
    // عقد الإيجار: صف publishing منتهي يُستعاد.
    expect(arg.where.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'publishing' })]),
    )
  })

  it('خسارة المطالبة لمنشور نُشر فعلاً → skipped/already_published بلا إرسال', async () => {
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ ...scheduledRow })
      .mockResolvedValueOnce({ status: 'published', externalId: '999' })
    mockDb.socialPost.updateMany.mockResolvedValue({ count: 0 })

    const result = await publishSocialPost('p1', { source: 'cron' })

    expect(result).toMatchObject({ status: 'skipped', reason: 'already_published' })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('صف publishing عمره 20 دقيقة يُستعاد ويُرسل مرة واحدة مع تثبيت حد العقد', async () => {
    const twentyMinAgo = new Date(Date.now() - 20 * 60_000)
    mockDb.socialPost.findUnique.mockResolvedValue({
      ...scheduledRow,
      status: 'publishing',
      updatedAt: twentyMinAgo,
    })
    mockDb.socialPost.updateMany.mockResolvedValue({ count: 1 })

    const before = Date.now()
    const result = await publishSocialPost('p1', { source: 'cron' })

    expect(result.status).toBe('published')
    expect(mockSend).toHaveBeenCalledTimes(1)
    // حد العقد ≈ 15 دقيقة خلت — يثبّت PUBLISH_LEASE_MS ضد الانزلاق.
    const arg = mockDb.socialPost.updateMany.mock.calls[0][0]
    const leaseClause = (arg.where.OR as Array<Record<string, unknown>>).find(
      (c) => c.status === 'publishing',
    ) as { updatedAt: { lt: Date } }
    const cutoff = leaseClause.updatedAt.lt.getTime()
    expect(cutoff).toBeLessThanOrEqual(before - 15 * 60_000 + 5_000)
    expect(cutoff).toBeGreaterThanOrEqual(before - 15 * 60_000 - 5_000)
  })

  it('صف publishing عمره دقيقة واحدة → skipped/in_progress بلا إرسال', async () => {
    const oneMinAgo = new Date(Date.now() - 60_000)
    mockDb.socialPost.findUnique
      .mockResolvedValueOnce({ ...scheduledRow, status: 'publishing', updatedAt: oneMinAgo })
      .mockResolvedValueOnce({ status: 'publishing', externalId: null })
    // قاعدة البيانات لا تطابق: العقد حيّ.
    mockDb.socialPost.updateMany.mockResolvedValue({ count: 0 })

    const result = await publishSocialPost('p1', { source: 'cron' })

    expect(result).toMatchObject({ status: 'skipped', reason: 'in_progress' })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('منشور مرتبط بقالب مؤرشف يحتفظ بنشره (لقطة وقت الحفظ — الخلود)', async () => {
    // post.templateId يشير لقالب، والقالب مؤرشف منذ الجدولة — النشر يعمل
    // أبداً بلا قراءة قالب (mock db يرمي لو قُرئ).
    mockDb.socialPost.findUnique.mockResolvedValue({ ...scheduledRow, templateId: 'tpl-archived' })
    mockDb.socialPost.updateMany.mockResolvedValue({ count: 1 })

    const result = await publishSocialPost('p1', { source: 'cron' })

    expect(result.status).toBe('published')
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})
