/**
 * GET /api/admin/social/overview — لمحة Social Hub.
 */
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getActiveSocialPlatforms, SOCIAL_PLATFORMS } from '@/lib/social/platforms'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    await requireAdmin()

    const now = new Date()
    const since30d = new Date(now.getTime() - THIRTY_DAYS_MS)
    const since7d = new Date(now.getTime() - SEVEN_DAYS_MS)

    const telegramWhere = { platform: 'telegram' } as const

    const [
      published30d,
      scheduled,
      failed,
      templates,
      destinations,
      nextScheduled,
      recentPublished,
      published7d,
      failed7d,
      failed30d,
      publishedPosts30d,
    ] = await Promise.all([
      db.socialPost.count({
        where: { ...telegramWhere, status: 'published', publishedAt: { gte: since30d } },
      }),
      db.socialPost.count({ where: { ...telegramWhere, status: 'scheduled' } }),
      db.socialPost.count({ where: { ...telegramWhere, status: 'failed' } }),
      db.socialPostTemplate.count({ where: { platform: 'telegram' } }),
      db.telegramDestination.count(),
      db.socialPost.findMany({
        where: { ...telegramWhere, status: 'scheduled', scheduledFor: { gte: now } },
        orderBy: { scheduledFor: 'asc' },
        take: 5,
        select: { id: true, title: true, body: true, scheduledFor: true, platform: true },
      }),
      db.socialPost.findMany({
        where: { ...telegramWhere, status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          body: true,
          publishedAt: true,
          externalId: true,
          platform: true,
        },
      }),
      db.socialPost.count({
        where: { ...telegramWhere, status: 'published', publishedAt: { gte: since7d } },
      }),
      db.socialPost.count({
        where: { ...telegramWhere, status: 'failed', createdAt: { gte: since7d } },
      }),
      db.socialPost.count({
        where: { ...telegramWhere, status: 'failed', createdAt: { gte: since30d } },
      }),
      db.socialPost.findMany({
        where: { ...telegramWhere, status: 'published', publishedAt: { gte: since30d } },
        select: { createdAt: true, publishedAt: true, attempts: true },
      }),
    ])

    const platforms = SOCIAL_PLATFORMS.map((platform) => {
      const isActive = platform.status === 'active'
      return {
        key: platform.key,
        labelAr: platform.labelAr,
        status: platform.status,
        href: platform.href,
        color: platform.color,
        capabilities: platform.capabilities,
        posts: isActive
          ? { published30d, scheduled, failed }
          : { published30d: 0, scheduled: 0, failed: 0 },
        templates: isActive ? templates : 0,
        destinations: isActive ? destinations : null,
      }
    })

    const total7d = published7d + failed7d
    const successRate7d = total7d > 0 ? Number(((published7d / total7d) * 100).toFixed(2)) : 0
    const total30d = published30d + failed30d
    const successRate30d = total30d > 0 ? Number(((published30d / total30d) * 100).toFixed(2)) : 0
    const failureRate7d = total7d > 0 ? Number(((failed7d / total7d) * 100).toFixed(2)) : 0

    const latencies = publishedPosts30d
      .filter((p) => p.publishedAt && p.createdAt)
      .map((p) =>
        Math.max(0, new Date(p.publishedAt as Date).getTime() - new Date(p.createdAt).getTime()),
      )
    const avgPublishLatencyMs =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0

    const retries = publishedPosts30d.reduce(
      (sum, p) => sum + Math.max(0, (p.attempts ?? 1) - 1),
      0,
    )
    const totalAttempts = publishedPosts30d.reduce(
      (sum, p) => sum + Math.max(1, p.attempts ?? 1),
      0,
    )
    const retryRate = totalAttempts > 0 ? Number(((retries / totalAttempts) * 100).toFixed(2)) : 0

    const mttr = 0

    const reliability = {
      successRate7d,
      successRate30d,
      avgPublishLatencyMs,
      retryRate,
      failureRate7d,
      mttr,
    }

    return ok({
      platforms,
      totals: { published30d, scheduled, failed },
      nextScheduled: nextScheduled.map((post) => ({
        id: post.id,
        title: post.title,
        label: post.title || post.body.slice(0, 60),
        scheduledFor: post.scheduledFor,
        platform: post.platform,
      })),
      recentPublished: recentPublished.map((post) => ({
        id: post.id,
        title: post.title,
        label: post.title || post.body.slice(0, 60),
        publishedAt: post.publishedAt,
        externalId: post.externalId,
        platform: post.platform,
      })),
      activePlatforms: getActiveSocialPlatforms().map((platform) => platform.key),
      reliability,
      kpis: reliability,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على السوشيال ميديا للإدارة فقط')
    logger.error('[admin/social/overview GET] failed:', err)
    return internalError('تعذّر تحميل لمحة السوشيال ميديا')
  }
}
