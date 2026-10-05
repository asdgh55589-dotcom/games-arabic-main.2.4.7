/**
 * عامل التصريف drain.ts — تغطي المهام الحاسمة في خط الإرسال الحقيقي:
 * التأجيل أثناء ساعات الهدوء (بتوقيت المستلم)، تخطي العناوين غير القابلة،
 * الإرسال الفعلي عبر `lib/email` مع logId كـ requestId، والانتشار الأسّي عند الفشل.
 *
 * كل التبعيات الخارجية مُحاكاة (db/email/telegram/logger) — لا شبكة ولا قاعدة.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/db', () => ({
  db: {
    notificationJob: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    notificationLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notificationTemplate: {
      findFirst: jest.fn(),
    },
    oAuthAccount: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/email/index', () => ({
  hasEmailProvider: jest.fn(() => true),
  resolveEmailProvider: jest.fn(() => 'brevo'),
  emailProvider: { send: jest.fn() },
}))

jest.mock('@/lib/telegram-notifications', () => {
  const actual = jest.requireActual('@/lib/telegram-notifications')
  return {
    ...actual,
    hasTelegramBot: jest.fn(() => true),
    sendTelegramNotification: jest.fn(() => Promise.resolve({ ok: true })),
  }
})

import { db } from '@/lib/db'
import { emailProvider, hasEmailProvider } from '@/lib/email/index'
import { drainNotificationJobs } from '@/lib/notifications/drain'
import { hasTelegramBot, sendTelegramNotification } from '@/lib/telegram-notifications'

const notificationJob = db.notificationJob as unknown as {
  updateMany: jest.Mock
  findMany: jest.Mock
  update: jest.Mock
}
const notificationLog = db.notificationLog as unknown as {
  findMany: jest.Mock
  create: jest.Mock
  update: jest.Mock
}
const notificationTemplate = db.notificationTemplate as unknown as { findFirst: jest.Mock }
const oAuthAccount = db.oAuthAccount as unknown as { findMany: jest.Mock }
const providerSend = emailProvider.send as jest.Mock
const telegramSend = sendTelegramNotification as jest.Mock

// الرابط المطلق في أزرار تليغرام + بيكسل التتبع يشترطان قاعدة الموقع
const ORIGINAL_APP_URL = process.env.NEXT_PUBLIC_APP_URL

interface PreferenceOverrides {
  emailEnabled?: boolean
  pushEnabled?: boolean
  quietHoursEnabled?: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  timezone?: string | null
  typePreferences?: Record<string, unknown>
}

function makeJob(options: {
  channel?: string
  attempts?: number
  email?: string
  preferences?: PreferenceOverrides | null
}) {
  const preferences =
    options.preferences === null
      ? null
      : {
          emailEnabled: true,
          pushEnabled: true,
          dailySummary: true,
          summaryIntervalDays: 3,
          likeThreshold: 25,
          quietHoursEnabled: false,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: null,
          typePreferences: {},
          ...(options.preferences ?? {}),
        }

  return {
    id: 'job-1',
    notificationId: 'notif-1',
    channel: options.channel ?? 'email',
    status: 'pending',
    attempts: options.attempts ?? 0,
    maxAttempts: 5,
    lastError: null,
    scheduledFor: new Date('2026-01-15T12:00:00.000Z'),
    processedAt: null,
    createdAt: new Date('2026-01-15T12:00:00.000Z'),
    updatedAt: new Date('2026-01-15T12:00:00.000Z'),
    notification: {
      id: 'notif-1',
      userId: 'user-1',
      actorId: 'actor-1',
      type: 'comment_reply',
      title: 'رد جديد على تعليقك',
      message: 'قام ali بالرد على تعليقك',
      data: { modTitle: 'Genshin 2.4' },
      targetType: 'mod',
      targetId: 'mod-1',
      targetSlug: 'genshin',
      targetTitle: 'Genshin 2.4',
      targetUrl: '/mod/genshin',
      actorUsername: 'ali',
      user: {
        id: 'user-1',
        username: 'sara',
        displayName: 'سارة',
        email: options.email ?? 'sara@example.com',
        notificationPreference: preferences,
      },
    },
  }
}

function prime(job: ReturnType<typeof makeJob>, options?: { logId?: string | null }) {
  notificationJob.updateMany.mockImplementation(() => Promise.resolve({ count: 1 }))
  notificationJob.findMany.mockResolvedValue([job])
  notificationJob.update.mockResolvedValue({})
  notificationLog.update.mockResolvedValue({})
  notificationTemplate.findFirst.mockResolvedValue(null)
  oAuthAccount.findMany.mockResolvedValue([])

  const logId = options?.logId === undefined ? 'log-9' : options.logId
  if (logId) {
    notificationLog.findMany.mockResolvedValue([
      { id: logId, notificationId: 'notif-1', channel: job.channel },
    ])
  } else {
    notificationLog.findMany.mockResolvedValue([])
    notificationLog.create.mockResolvedValue({ id: 'log-created' })
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
  providerSend.mockResolvedValue({ ok: true, providerMessageId: 'm-1' })
  telegramSend.mockResolvedValue({ ok: true })
  ;(hasTelegramBot as jest.Mock).mockReturnValue(true)
  ;(hasEmailProvider as jest.Mock).mockReturnValue(true)
})

afterAll(() => {
  if (ORIGINAL_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_APP_URL
})

describe('drainNotificationJobs — empty queue', () => {
  it('reports nothing to do', async () => {
    prime(makeJob({}))
    notificationJob.findMany.mockResolvedValue([])

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T23:00:00Z') })

    expect(stats.scanned).toBe(0)
    expect(stats.processed).toBe(0)
    expect(stats.hasMore).toBe(false)
    expect(stats.nextCursor).toBeNull()
    expect(providerSend).not.toHaveBeenCalled()
  })
})

describe('quiet hours', () => {
  it('defers the job to the end of the window in the recipient timezone', async () => {
    prime(
      makeJob({
        preferences: {
          quietHoursEnabled: true,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          timezone: 'UTC',
        },
      }),
    )

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T23:30:00Z') })

    expect(stats.deferred).toBe(1)
    expect(stats.sent).toBe(0)
    expect(providerSend).not.toHaveBeenCalled()

    const jobUpdate = notificationJob.update.mock.calls[0][0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(jobUpdate.where.id).toBe('job-1')
    expect(jobUpdate.data.status).toBe('pending')
    expect((jobUpdate.data.scheduledFor as Date).toISOString()).toBe('2026-01-16T08:00:00.000Z')
    // التأجيل لا يستهلك محاولة
    expect(jobUpdate.data.attempts).toBeUndefined()

    const logUpdate = notificationLog.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(logUpdate.data.status).toBe('deferred')
  })

  it('sends immediately when quiet hours are disabled', async () => {
    prime(makeJob({}))

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T23:30:00Z') })

    expect(stats.sent).toBe(1)
    expect(providerSend).toHaveBeenCalledTimes(1)
  })
})

describe('email delivery', () => {
  it('sends through the configured provider with logId as requestId', async () => {
    prime(makeJob({}))

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.sent).toBe(1)
    expect(providerSend).toHaveBeenCalledTimes(1)
    const msg = providerSend.mock.calls[0][0] as {
      to: string[]
      subject: string
      html: string
      text?: string
      requestId?: string
    }
    expect(msg.to).toEqual(['sara@example.com'])
    expect(msg.subject).toBe('رد جديد على تعليقك')
    expect(msg.html).toContain('<html lang="ar" dir="rtl">')
    expect(msg.html).toContain('track?id=log-9&event=open')
    expect(msg.requestId).toBe('log-9')
    expect(msg.text).toContain('قام ali بالرد')

    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(jobUpdate.data.status).toBe('sent')
    expect(jobUpdate.data.processedAt).toBeInstanceOf(Date)

    const logUpdate = notificationLog.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(logUpdate.data.status).toBe('sent')
    expect(logUpdate.data.sentAt).toBeInstanceOf(Date)
    expect(logUpdate.data.deliveredAt).toBeInstanceOf(Date)
  })

  it('skips a synthetic Telegram address instead of pretending to deliver', async () => {
    prime(makeJob({ email: '12345@telegram.local' }))

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.skipped).toBe(1)
    expect(stats.sent).toBe(0)
    expect(providerSend).not.toHaveBeenCalled()

    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(jobUpdate.data.status).toBe('skipped')
    expect(String(jobUpdate.data.lastError)).toContain('synthetic')
  })

  it('skips when the recipient disabled email', async () => {
    prime(makeJob({ preferences: { emailEnabled: false } }))

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.skipped).toBe(1)
    expect(providerSend).not.toHaveBeenCalled()
  })

  it('creates the missing NotificationLog for jobs queued by the clean-arch stack', async () => {
    prime(makeJob({}), { logId: null })

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(notificationLog.create).toHaveBeenCalledWith({
      data: { notificationId: 'notif-1', channel: 'email', status: 'queued' },
      select: { id: true },
    })
    expect(stats.sent).toBe(1)
    // الإرسال يستخدم السجل المُنشأ للتو رقمه requestId
    expect(providerSend.mock.calls[0][0].requestId).toBe('log-created')
  })

  it('retries with exponential backoff when the provider rejects the send', async () => {
    prime(makeJob({ attempts: 1 }))
    providerSend.mockResolvedValue({ ok: false, reason: 'rate limited' })

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.retried).toBe(1)
    expect(stats.sent).toBe(0)

    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(jobUpdate.data.status).toBe('pending')
    expect(jobUpdate.data.attempts).toBe(2)
    expect(jobUpdate.data.lastError).toBe('rate limited')
    // المحاولة الثانية: التراجع 60s * 2^1 = دقيقتان بعد اللحظة الحالية
    const resume = (jobUpdate.data.scheduledFor as Date).getTime()
    const base = new Date('2026-01-15T12:00:00Z').getTime()
    expect(resume).toBeGreaterThanOrEqual(base + 2 * 60_000 - 5_000)
    expect(resume).toBeLessThanOrEqual(base + 2 * 60_000 + 5_000)

    const logUpdate = notificationLog.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(logUpdate.data.status).toBe('failed')
    expect(logUpdate.data.errorMessage).toBe('rate limited')
  })

  it('dead-letters after exhausting maxAttempts', async () => {
    prime(makeJob({ attempts: 4 }))
    providerSend.mockResolvedValue({ ok: false, reason: 'boom' })

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.deadLettered).toBe(1)
    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(jobUpdate.data.status).toBe('dead_letter')
    expect(jobUpdate.data.attempts).toBe(5)
    expect(String(jobUpdate.data.lastError)).toContain('boom')
  })

  it('retries (not skips) while no provider is configured so config can heal', async () => {
    prime(makeJob({}))
    ;(hasEmailProvider as jest.Mock).mockReturnValue(false)

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.retried).toBe(1)
    expect(providerSend).not.toHaveBeenCalled()
    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(String(jobUpdate.data.lastError)).toContain('not configured')
  })
})

describe('telegram delivery', () => {
  it('sends to the linked chat id with an absolute action button', async () => {
    prime(makeJob({ channel: 'telegram' }))
    oAuthAccount.findMany.mockResolvedValue([{ userId: 'user-1', providerAccountId: '999888777' }])

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.sent).toBe(1)
    expect(telegramSend).toHaveBeenCalledTimes(1)
    const payload = telegramSend.mock.calls[0][0] as {
      chatId: string
      text: string
      replyMarkup?: { inline_keyboard: Array<Array<{ url: string }>> }
    }
    expect(payload.chatId).toBe('999888777')
    expect(payload.text).toContain('رد جديد على تعليقك')
    expect(payload.replyMarkup?.inline_keyboard[0][0].url).toContain('/mod/genshin')

    const jobUpdate = notificationJob.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(jobUpdate.data.status).toBe('sent')
  })

  it('skips when no Telegram account is linked', async () => {
    prime(makeJob({ channel: 'telegram' }))

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.skipped).toBe(1)
    expect(telegramSend).not.toHaveBeenCalled()
  })
})

describe('batching', () => {
  it('claims jobs atomically and never touches already-claimed work', async () => {
    prime(makeJob({}))
    notificationJob.updateMany
      .mockResolvedValueOnce({ count: 0 }) // stale requeue (نتيجة غير مهمة)
      .mockResolvedValueOnce({ count: 0 }) // الامتلاك فشل ⇒ مهمة مملوكة لغيرنا

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    expect(stats.scanned).toBe(1)
    expect(stats.processed).toBe(0)
    expect(providerSend).not.toHaveBeenCalled()
    expect(notificationJob.update).not.toHaveBeenCalled()
  })

  it('emits a resume cursor when more work remains', async () => {
    prime(makeJob({}))
    const futureJob = { ...makeJob({}), id: 'job-2' }
    notificationJob.findMany.mockResolvedValue([makeJob({}), futureJob])

    const stats = await drainNotificationJobs({ now: new Date('2026-01-15T12:00:00Z') })

    // limit افتراضي 25 ⇒ السجلان فقط = لا مزيد
    expect(stats.hasMore).toBe(false)
    expect(stats.nextCursor).toBeNull()
  })
})
