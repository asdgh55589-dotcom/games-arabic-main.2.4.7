/**
 * lib/notifications/drain.ts — عامل تصريف طابور الإشعارات (P2)
 *
 * المستهلك الوحيد لمهام `NotificationJob` لكلا الطابورين:
 *  - مهام الكاتب legacy (service.ts) — بريد/Telegram
 *  - مهام clean-arch (PrismaJobQueue عبر use-cases) — بريد
 *
 * الخصائص:
 *  - دفعة محدودة (`limit` ≤ DRAIN_MAX_LIMIT) ضمن مهلة زمن (`deadlineMs`)
 *    حتى لا تتجاوز دالة cron زمن تشغيلها
 *  - مؤشر استئناف (`cursor`) — دفعة تنتهي بـ hasMore تُستأنف في النداء التالي
 *    من آخر مهمة نجحت بدل إعادة مسح الطابور
 *  - منع التكرار يقع عند الكتابة؛ هنا: ساعات الهدوء، تفضيلات المستخدم،
 *    ثم الإرسال الفعلي عبر `lib/email` و`lib/telegram-notifications`
 *  - كل محاولة تُسجَّل في `NotificationLog` (logId ثابت يُستخدم كـ requestId
 *    وبيكسل تتبع في البريد)، والفشل يستخدم تراجع أسّي ثم `dead_letter`
 */

import type { Prisma } from '@prisma/client'
import { ExponentialBackoffDeliveryPolicy } from '@/domain/policies/delivery-policy'
import {
  isWithinQuietHours,
  nextQuietHoursEnd,
  type QuietHoursWindow,
} from '@/domain/policies/quiet-hours'
import { db } from '@/lib/db'
import { emailFrom } from '@/lib/email/from'
import { emailProvider, hasEmailProvider } from '@/lib/email/index'
import { logger } from '@/lib/logger'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import {
  hasTelegramBot,
  isValidChatId,
  sendTelegramNotification,
  urlButton,
} from '@/lib/telegram-notifications'
import {
  buildEmailHtml,
  buildEmailSubject,
  buildTelegramText,
  buildVariables,
  DRAIN_DEFAULT_DEADLINE_MS,
  DRAIN_DEFAULT_LIMIT,
  DRAIN_MAX_LIMIT,
  type DrainCursor,
  encodeDrainCursor,
  isChannelEnabled,
  stripHtml,
  withClickTracking,
} from './pipeline'
import { notificationSource } from './service'
import { renderNotificationContent } from './template-renderer'
import type { NotificationChannel } from './types'

/** تراجع أسّي: دقيقة → 2 → 4 → 8 (بحد أقصى 6 ساعات). */
const BACKOFF = new ExponentialBackoffDeliveryPolicy(60_000, 6 * 60 * 60 * 1000, 5_000)

/** مهمة عالقة في `processing` بعد انهيار العملية → تعود pending. */
const STALE_PROCESSING_MS = 15 * 60 * 1000

const TELEGRAM_ACTION_LABEL = 'عرض التفاصيل'

type JobRow = Prisma.NotificationJobGetPayload<{
  include: {
    notification: {
      include: { user: { include: { notificationPreference: true } } }
    }
  }
}>

export interface DrainOptions {
  /** لحظة التقييم (للوقت في الاختبارات). الافتراضي: الآن. */
  now?: Date
  /** حجم الدفعة (1..DRAIN_MAX_LIMIT). */
  limit?: number
  /** مهلة الدفعة بالمللي ثانية قبل التوقف والاستئناف لاحقاً. */
  deadlineMs?: number
  /** مؤشر الاستئناف من نداء سابق. */
  cursor?: DrainCursor | null
}

export interface DrainStats {
  /** المهام المستخرجة من الطابور في هذه الدفعة */
  scanned: number
  /** المهام التي عولجت فعلاً (تم امتلاكها) */
  processed: number
  sent: number
  retried: number
  deferred: number
  skipped: number
  deadLettered: number
  /** بقيت مهام تستحق المعالجة → استأنف بالـ nextCursor */
  hasMore: boolean
  nextCursor: string | null
  durationMs: number
}

type Outcome =
  | { kind: 'sent' }
  | { kind: 'deferred'; resumeAt: Date }
  | { kind: 'skipped'; reason: string }
  | { kind: 'retry'; reason: string }
  | { kind: 'dead_letter'; reason: string }

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/**
 * استخراج دفعة واحدة من الطابور ومعالجتها.
 * لا يرمي أبداً: كل خطأ يتحول إلى retry/dead_letter على مهمة واحدة.
 */
export async function drainNotificationJobs(options: DrainOptions = {}): Promise<DrainStats> {
  const startedAt = Date.now()
  const now = options.now ?? new Date()
  const limit = clamp(options.limit ?? DRAIN_DEFAULT_LIMIT, 1, DRAIN_MAX_LIMIT)
  const deadlineAt = startedAt + (options.deadlineMs ?? DRAIN_DEFAULT_DEADLINE_MS)
  const incomingCursor = options.cursor ?? null

  const stats: DrainStats = {
    scanned: 0,
    processed: 0,
    sent: 0,
    retried: 0,
    deferred: 0,
    skipped: 0,
    deadLettered: 0,
    hasMore: false,
    nextCursor: null,
    durationMs: 0,
  }

  // 0) إحياء مهام عالقة في `processing` (انهيار عملية سابقة)
  try {
    await db.notificationJob.updateMany({
      where: { status: 'processing', updatedAt: { lt: new Date(startedAt - STALE_PROCESSING_MS) } },
      data: { status: 'pending' },
    })
  } catch (err) {
    logger.warn({ err }, '[notification-drain] stale requeue failed')
  }

  // 1) الدفعة — مرتّبة (scheduledFor, id) لكي يكون المؤشر متمكّناً
  const rows = await db.notificationJob.findMany({
    where: {
      status: 'pending',
      scheduledFor: { lte: now },
      ...(incomingCursor
        ? {
            OR: [
              { scheduledFor: { gt: new Date(incomingCursor.scheduledFor) } },
              {
                scheduledFor: new Date(incomingCursor.scheduledFor),
                id: { gt: incomingCursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    include: {
      notification: { include: { user: { include: { notificationPreference: true } } } },
    },
  })

  const hasMoreRows = rows.length > limit
  const batch = rows.slice(0, limit)
  stats.scanned = batch.length

  if (batch.length === 0) {
    stats.durationMs = Date.now() - startedAt
    return stats
  }

  // 2) تحميل مسبق (لا استعلام داخل الحلقة): السجلات + معرّفات تليغرام
  const notificationIds = [...new Set(batch.map((j) => j.notificationId))]
  const userIds = [
    ...new Set(
      batch
        .map((j) => j.notification?.userId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ]

  const [logRows, telegramLinks] = await Promise.all([
    db.notificationLog.findMany({
      where: { notificationId: { in: notificationIds } },
      select: { id: true, notificationId: true, channel: true },
    }),
    userIds.length > 0
      ? db.oAuthAccount.findMany({
          where: { userId: { in: userIds }, provider: 'telegram' },
          select: { userId: true, providerAccountId: true },
        })
      : Promise.resolve([]),
  ])

  const logByJob = new Map<string, string>()
  for (const row of logRows) logByJob.set(`${row.notificationId}:${row.channel}`, row.id)
  const telegramByUser = new Map<string, string>()
  for (const link of telegramLinks) {
    if (isValidChatId(link.providerAccountId)) {
      telegramByUser.set(link.userId, link.providerAccountId)
    }
  }

  let cursor: DrainCursor | null = incomingCursor
  let stoppedEarly = false

  // 3) المعالجة — مهمة واحدة في كل مرة حتى لا نتجاوز المهلة
  for (const job of batch) {
    if (Date.now() >= deadlineAt) {
      stoppedEarly = true
      break
    }

    const nextCursor: DrainCursor = { scheduledFor: job.scheduledFor.getTime(), id: job.id }

    // امتلاك ذرّي: من يفوز بـ status=pending هو من يعالج
    const claimed = await db.notificationJob.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'processing' },
    })
    if (claimed.count === 0) {
      cursor = nextCursor
      continue
    }

    try {
      const logId = await ensureLog(job, logByJob)
      const outcome = await deliver(job, {
        now,
        logId,
        telegramChatId: job.notification?.userId
          ? (telegramByUser.get(job.notification.userId) ?? null)
          : null,
      })
      // العدّ حسب النتيجة المطبَّقة فعلاً: "retry" قد ينتهي dead_letter
      tally(stats, await applyOutcome(job, outcome, logId, now))
    } catch (err) {
      // خطأ غير متوقعة على مهمة واحدة لا يجب أن توقف الدفعة كلها
      const reason = err instanceof Error ? err.message : String(err)
      logger.error({ err, jobId: job.id }, '[notification-drain] job failed')
      const applied = await applyOutcome(job, { kind: 'retry', reason }, null, now).catch(
        () => null,
      )
      tally(stats, applied ?? 'retry')
    }

    stats.processed++
    cursor = nextCursor
  }

  stats.hasMore = hasMoreRows || stoppedEarly
  stats.nextCursor = stats.hasMore ? (cursor ? encodeDrainCursor(cursor) : null) : null
  stats.durationMs = Date.now() - startedAt

  logger.info({ ...stats }, '[notification-drain] batch complete')
  return stats
}

function tally(stats: DrainStats, kind: Outcome['kind']): void {
  if (kind === 'sent') stats.sent++
  else if (kind === 'deferred') stats.deferred++
  else if (kind === 'skipped') stats.skipped++
  else if (kind === 'retry') stats.retried++
  else stats.deadLettered++
}

/** سجل القناة — يُنشأ الآن إن لم يكن موجوداً (مهام الطابور القديم بلا سجل). */
async function ensureLog(job: JobRow, logByJob: Map<string, string>): Promise<string | null> {
  const key = `${job.notificationId}:${job.channel}`
  const existing = logByJob.get(key)
  if (existing) return existing
  try {
    const created = await db.notificationLog.create({
      data: { notificationId: job.notificationId, channel: job.channel, status: 'queued' },
      select: { id: true },
    })
    logByJob.set(key, created.id)
    return created.id
  } catch (err) {
    logger.warn({ err, jobId: job.id }, '[notification-drain] log create failed')
    return null
  }
}

function quietWindowOf(
  prefs: {
    quietHoursEnabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
    timezone: string | null
  } | null,
): QuietHoursWindow | null {
  if (!prefs?.quietHoursEnabled) return null
  return {
    quietHoursEnabled: true,
    quietHoursStart: prefs.quietHoursStart,
    quietHoursEnd: prefs.quietHoursEnd,
    timezone: prefs.timezone,
  }
}

/**
 * قرار التسليم — نقية بقدر الإمكان: تُرجع ما يجب فعله ولا تكتب في القاعدة.
 */
async function deliver(
  job: JobRow,
  ctx: { now: Date; logId: string | null; telegramChatId: string | null },
): Promise<Outcome> {
  const notification = job.notification
  const user = notification?.user
  const preferences = user?.notificationPreference ?? null
  const channel = job.channel

  if (!notification) return { kind: 'dead_letter', reason: 'notification row missing' }
  if (!user) return { kind: 'dead_letter', reason: 'recipient user missing' }

  // داخل التطبيق: التسليم = وجود صف الإشعار نفسه
  if (channel === 'in_app') return { kind: 'sent' }

  if (!isChannelEnabled(preferences, channel as NotificationChannel, notification.type)) {
    return { kind: 'skipped', reason: 'disabled by user preferences' }
  }

  // ساعات الهدوء (بمنطقة المستلم الزمنية) → تأجيل بدل ضياع الإشعار
  const quiet = quietWindowOf(preferences)
  if (quiet && isWithinQuietHours(ctx.now, quiet)) {
    return { kind: 'deferred', resumeAt: nextQuietHoursEnd(ctx.now, quiet) }
  }

  if (channel === 'email') return sendEmailFor(job, ctx)
  if (channel === 'telegram') return sendTelegramFor(job, ctx.telegramChatId)

  return { kind: 'skipped', reason: `unknown channel "${channel}"` }
}

async function sendEmailFor(
  job: JobRow,
  ctx: { now: Date; logId: string | null },
): Promise<Outcome> {
  const notification = job.notification
  const user = notification.user
  const email = (user.email ?? '').trim()

  if (!email) return { kind: 'skipped', reason: 'recipient has no email address' }
  if (isSyntheticTelegramEmail(email)) {
    return { kind: 'skipped', reason: 'synthetic telegram email address' }
  }
  if (!hasEmailProvider()) {
    // لا نعرف أولاً إن كان الناقص تهيئة دائمة — نحاول ثم نموت في dead_letter
    // بعد محاولات maxAttempts بحيث يظهر في /admin/notifications-health.
    return { kind: 'retry', reason: 'email provider not configured' }
  }

  const variables = buildVariables(notificationSource(notification), {
    username: user.username,
    displayName: user.displayName,
  })
  const content = await renderNotificationContent(notification.type, 'email', variables, {
    title: notification.title,
    message: notification.message,
  })

  const subject = buildEmailSubject(content.title)
  const actionUrl = ctx.logId
    ? withClickTracking(notification.targetUrl ?? undefined, ctx.logId)
    : (notification.targetUrl ?? undefined)
  const html = buildEmailHtml({
    subject,
    body: content.message,
    recipientName: user.displayName || user.username,
    ...(actionUrl ? { actionUrl } : {}),
    actionLabel: notification.targetTitle || 'عرض التفاصيل',
    ...(ctx.logId ? { logId: ctx.logId } : {}),
  })

  const result = await emailProvider.send({
    from: emailFrom(),
    to: [email],
    subject,
    html,
    text: `${subject}\n\n${stripHtml(content.message)}`,
    ...(ctx.logId ? { requestId: ctx.logId } : {}),
  })

  if (result.ok) return { kind: 'sent' }
  return { kind: 'retry', reason: result.reason || 'email send failed' }
}

async function sendTelegramFor(job: JobRow, chatId: string | null): Promise<Outcome> {
  const notification = job.notification
  const user = notification.user

  if (!chatId || !isValidChatId(chatId)) {
    return { kind: 'skipped', reason: 'telegram account not linked' }
  }
  if (!hasTelegramBot()) {
    return { kind: 'retry', reason: 'telegram bot not configured' }
  }

  const variables = buildVariables(notificationSource(notification), {
    username: user.username,
    displayName: user.displayName,
  })
  const content = await renderNotificationContent(notification.type, 'telegram', variables, {
    title: notification.title,
    message: notification.message,
  })

  const text = buildTelegramText({
    title: content.title,
    message: content.message,
    ...(notification.targetUrl ? { actionUrl: absoluteUrl(notification.targetUrl) } : {}),
    actionLabel: notification.targetTitle || TELEGRAM_ACTION_LABEL,
  })

  const keyboardUrl = notification.targetUrl ? absoluteUrl(notification.targetUrl) : ''
  const result = await sendTelegramNotification({
    chatId,
    text,
    ...(keyboardUrl ? { replyMarkup: urlButton(TELEGRAM_ACTION_LABEL, keyboardUrl) } : {}),
  })

  if (result.ok) return { kind: 'sent' }
  return { kind: 'retry', reason: result.error || 'telegram send failed' }
}

/** زر تليغرام يشترط رابطاً مطلقاً. */
function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(
    /\/$/,
    '',
  )
  if (!base) return ''
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * كتابة نتيجة المعالجة في المهمة + سجلها.
 * الفشل يستهلك محاولة؛ التأجيل لا يستهلك شيئاً.
 */
async function applyOutcome(
  job: JobRow,
  outcome: Outcome,
  logId: string | null,
  now: Date,
): Promise<Outcome['kind']> {
  const jobData: Prisma.NotificationJobUpdateInput = {}
  const logData: Prisma.NotificationLogUpdateInput = {}
  // النتيجة التي ستُكتب فعلاً (قد تختلف عن `retry` عند نفاد المحاولات)
  let applied: Outcome['kind'] = outcome.kind

  switch (outcome.kind) {
    case 'sent':
      jobData.status = 'sent'
      jobData.processedAt = now
      jobData.lastError = null
      logData.status = 'sent'
      logData.sentAt = now
      logData.deliveredAt = now
      logData.errorMessage = null
      break
    case 'deferred':
      jobData.status = 'pending'
      jobData.scheduledFor = outcome.resumeAt
      logData.status = 'deferred'
      break
    case 'skipped':
      jobData.status = 'skipped'
      jobData.processedAt = now
      jobData.lastError = outcome.reason
      logData.status = 'skipped'
      logData.errorMessage = outcome.reason
      break
    case 'dead_letter':
      jobData.status = 'dead_letter'
      jobData.processedAt = now
      jobData.attempts = job.attempts + 1
      jobData.lastError = outcome.reason
      logData.status = 'failed'
      logData.errorMessage = outcome.reason
      break
    case 'retry': {
      const attempts = job.attempts + 1
      if (attempts >= job.maxAttempts) {
        jobData.status = 'dead_letter'
        jobData.processedAt = now
        jobData.attempts = attempts
        jobData.lastError = outcome.reason
        logData.status = 'failed'
        logData.errorMessage = `dead_letter after ${attempts} attempts: ${outcome.reason}`
        // الفشل استنفد محاولاته — النتيجة المطبَّقة ليست retry
        applied = 'dead_letter'
      } else {
        jobData.status = 'pending'
        jobData.scheduledFor = new Date(now.getTime() + BACKOFF.calculateRetryDelay(job.attempts))
        jobData.attempts = attempts
        jobData.lastError = outcome.reason
        logData.status = 'failed'
        logData.errorMessage = outcome.reason
      }
      break
    }
  }

  await db.notificationJob.update({ where: { id: job.id }, data: jobData })
  if (logId) {
    await db.notificationLog.update({ where: { id: logId }, data: logData }).catch((err) => {
      logger.warn({ err, logId }, '[notification-drain] log update failed')
    })
  }

  return applied
}
