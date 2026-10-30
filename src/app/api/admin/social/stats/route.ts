/**
 * GET /api/admin/social/stats — إحصاءات Social Hub.
 */
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isSocialPlatformKey } from '@/lib/social/platforms'

const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const
type RangeKey = keyof typeof RANGES

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildDayAxis(from: Date, to: Date): string[] {
  const days: string[] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  for (let guard = 0; cursor <= end && guard < 400; guard += 1) {
    days.push(dayKey(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const platformParam = searchParams.get('platform') ?? 'telegram'
    const rangeParam = (searchParams.get('range') ?? '7d') as RangeKey

    if (!isSocialPlatformKey(platformParam)) {
      return validationFail({ platform: [`منصة غير معروفة: ${platformParam}`] }, req.url)
    }
    if (!(rangeParam in RANGES)) {
      return validationFail(
        { range: [`نطاق غير صالح: ${rangeParam} — استخدم 7d أو 30d أو 90d`] },
        req.url,
      )
    }

    const platform = platformParam
    const range = rangeParam
    const now = new Date()
    const days = RANGES[range]
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const upcomingSince = now

    const [
      publishedPosts,
      failedPosts,
      upcomingCount,
      destinations,
      notificationTemplates,
      postTemplates,
      telegramLogs,
    ] = await Promise.all([
      db.socialPost.findMany({
        where: { platform, status: 'published', publishedAt: { gte: since } },
        select: { publishedAt: true, createdAt: true, attempts: true },
      }),
      db.socialPost.findMany({
        where: { platform, status: 'failed', createdAt: { gte: since } },
        select: { createdAt: true },
      }),
      db.socialPost.count({
        where: { platform, status: 'scheduled', scheduledFor: { gte: upcomingSince } },
      }),
      db.telegramDestination.count(),
      db.notificationTemplate.count({ where: { channel: 'telegram' } }),
      db.socialPostTemplate.count({ where: { platform } }),
      db.notificationLog.groupBy({
        by: ['status'],
        where: { channel: 'telegram', createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ])

    const axis = buildDayAxis(since, now)
    const byDay = new Map<string, { published: number; failed: number }>(
      axis.map((day) => [day, { published: 0, failed: 0 }]),
    )
    for (const post of publishedPosts) {
      if (!post.publishedAt) continue
      const key = dayKey(post.publishedAt)
      const bucket = byDay.get(key)
      if (bucket) bucket.published += 1
    }
    for (const post of failedPosts) {
      const key = dayKey(post.createdAt)
      const bucket = byDay.get(key)
      if (bucket) bucket.failed += 1
    }
    const timeSeries = axis.map((date) => ({
      date,
      published: byDay.get(date)?.published ?? 0,
      failed: byDay.get(date)?.failed ?? 0,
    }))

    const published = timeSeries.reduce((sum, day) => sum + day.published, 0)
    const failed = timeSeries.reduce((sum, day) => sum + day.failed, 0)
    const daysInRange = Math.max(
      1,
      Math.floor((now.getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) + 1,
    )
    const avgPerDay = timeSeries.length > 0 ? Number((published / daysInRange).toFixed(2)) : 0

    const [destinationsActive, destinationsVerified] = await Promise.all([
      db.telegramDestination.count({ where: { status: 'active' } }),
      db.telegramDestination.count({ where: { verificationStatus: 'verified' } }),
    ])

    let notificationsSent = 0
    let notificationsFailed = 0
    for (const row of telegramLogs) {
      const count = row._count?._all ?? 0
      if (row.status === 'sent' || row.status === 'delivered' || row.status === 'success') {
        notificationsSent += count
      } else if (row.status === 'failed' || row.status === 'dead_letter') {
        notificationsFailed += count
      }
    }

    // ===== KPIs موثوقية (Phase 4) =====
    const total = published + failed
    const successRate = total > 0 ? Number(((published / total) * 100).toFixed(2)) : 0
    const failureRate = total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0

    const latencies = publishedPosts
      .filter((p) => p.publishedAt && p.createdAt)
      .map((p) =>
        Math.max(0, new Date(p.publishedAt as Date).getTime() - new Date(p.createdAt).getTime()),
      )
    const avgPublishLatencyMs =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

    const retries = publishedPosts.reduce((sum, p) => sum + Math.max(0, (p.attempts ?? 1) - 1), 0)
    const totalAttempts = publishedPosts.reduce((sum, p) => sum + Math.max(1, p.attempts ?? 1), 0)
    const retryRate = totalAttempts > 0 ? Number(((retries / totalAttempts) * 100).toFixed(2)) : 0

    const mttr = 0

    // 7d / 30d compatibility
    const successRate7d = successRate
    const successRate30d = successRate
    const failureRate7d = failureRate

    return ok({
      platform,
      range,
      kpis: {
        published,
        failed,
        scheduledUpcoming: upcomingCount,
        avgPerDay,
        successRate,
        successRate7d,
        successRate30d,
        avgPublishLatencyMs,
        retryRate,
        mttr,
        failureRate,
        failureRate7d,
      },
      timeSeries,
      destinations: {
        total: destinations,
        active: destinationsActive,
        verified: destinationsVerified,
      },
      templates: { notification: notificationTemplates, post: postTemplates },
      notifications: { sent: notificationsSent, failed: notificationsFailed },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الإحصاءات متاحة للإدارة فقط')
    logger.error('[admin/social/stats GET] failed:', err)
    return internalError('تعذّر تحميل إحصاءات السوشيال ميديا')
  }
}
