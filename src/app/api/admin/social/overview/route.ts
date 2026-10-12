/**
 * GET /api/admin/social/overview — لمحة Social Hub.
 *
 * بطاقات المنصات + إجماليات + أقرب 5 مجدولة + آخر 5 منشورة.
 * الصلاحية: requireAdmin (قراءة فقط، بلا كتابة وبلا أي توكن بوت).
 */
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getActiveSocialPlatforms, SOCIAL_PLATFORMS } from '@/lib/social/platforms'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    await requireAdmin()

    const now = new Date()
    const since30d = new Date(now.getTime() - THIRTY_DAYS_MS)

    const telegramWhere = { platform: 'telegram' } as const

    const [
      published30d,
      scheduled,
      failed,
      templates,
      destinations,
      nextScheduled,
      recentPublished,
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
    ])

    // منصات قادمة لا تحمل أعمدة منشورات بعد — تُملأ بصفر بلا استعلام.
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

    return ok({
      platforms,
      totals: { published30d, scheduled, failed },
      nextScheduled: nextScheduled.map((post) => ({
        id: post.id,
        title: post.title,
        // body يُستخدم كعنوان بديل حين لا يوجد title — لا نعيد متن كامل
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
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح — الاطلاع على السوشيال ميديا للإدارة فقط')
    logger.error('[admin/social/overview GET] failed:', err)
    return internalError('تعذّر تحميل لمحة السوشيال ميديا')
  }
}
