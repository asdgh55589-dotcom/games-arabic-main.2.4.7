import {
  MOCK_SOCIAL_OVERVIEW,
  MOCK_SOCIAL_STATS,
  type SocialStatsRange,
  socialPostsUrl,
  socialPostUrl,
  socialTemplatesUrl,
} from '@/hooks/use-social'
import { apiPathToAdminPath, findPageForPath } from '@/lib/admin-pages'

/**
 * B0 — أشكال البيانات التجريبية في `use-social.ts` يجب أن تطابق عقد W1 (§4)
 * حرفياً حتى تحلّ البيانات الحقيقية محلّها بلا أي تعديل في الواجهة.
 */

describe('use-social — مسارات الـ API متوافقة مع ترتيب الصفحات', () => {
  // نُحاكي ما يفعله `proxy.ts`: pathname → apiPathToAdminPath → findPageForPath.
  const toPageKey = (apiUrl: string) => {
    const path = new URL(apiUrl, 'https://x.test').pathname
    const adminPath = apiPathToAdminPath(path)
    return adminPath ? (findPageForPath(adminPath)?.key ?? null) : null
  }

  it('يبني مسارات منشورات/قوالب تحت بادئة /admin/social/telegram لا /admin/social', () => {
    // تثبيت الشكل: المسار يتبع تسلسل الصفحات المُسجَّل في admin-pages.
    expect(socialPostsUrl({})).toContain('/api/admin/social/telegram/posts?')
    expect(socialPostUrl('abc123')).toBe('/api/admin/social/telegram/posts/abc123')
    expect(socialTemplatesUrl()).toBe('/api/admin/social/telegram/templates?platform=telegram')
    expect(socialTemplatesUrl('telegram')).toBe(
      '/api/admin/social/telegram/templates?platform=telegram',
    )
  })

  it('تُنسب لصفحتيها المُسجَّلتين social-telegram-posts / social-telegram-templates', () => {
    // نفس مسار proxy: apiPathToAdminPath → findPageForPath (أطول بادئة).
    expect(toPageKey(socialPostsUrl({}))).toBe('social-telegram-posts')
    expect(toPageKey(socialPostUrl('abc123'))).toBe('social-telegram-posts')
    expect(toPageKey(socialTemplatesUrl())).toBe('social-telegram-templates')
  })
})

describe('use-social — أشكال اللمحة', () => {
  it('يعرّف المنصات الثلاث بحالاتها الصحيحة', () => {
    const byKey = Object.fromEntries(MOCK_SOCIAL_OVERVIEW.platforms.map((p) => [p.key, p]))
    expect(Object.keys(byKey).sort()).toEqual(['facebook', 'telegram', 'youtube'])
    expect(byKey.telegram.status).toBe('active')
    expect(byKey.facebook.status).toBe('coming_soon')
    expect(byKey.youtube.status).toBe('coming_soon')
  })

  it('يقدّم totals و nextScheduled و recentPublished بالأنواع المتوقعة', () => {
    const { totals, nextScheduled, recentPublished } = MOCK_SOCIAL_OVERVIEW
    for (const value of [totals.published30d, totals.scheduled, totals.failed]) {
      expect(Number.isFinite(value)).toBe(true)
    }
    expect(Array.isArray(nextScheduled)).toBe(true)
    expect(Array.isArray(recentPublished)).toBe(true)
    expect(typeof nextScheduled[0].scheduledFor).toBe('string')
    expect(typeof recentPublished[0].publishedAt).toBe('string')
  })
})

describe('use-social — أشكال الإحصاءات', () => {
  const ranges: SocialStatsRange[] = ['7d', '30d', '90d']

  it.each(ranges)('يملك %s سلسلة زمنية بالطول الصحيح', (range) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const stats = MOCK_SOCIAL_STATS[range]
    expect(stats.range).toBe(range)
    expect(stats.timeSeries).toHaveLength(days)
    for (const point of stats.timeSeries) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isFinite(point.published)).toBe(true)
      expect(Number.isFinite(point.failed)).toBe(true)
    }
  })

  it('يحتوي كل مفاتيح العقد (kpis/destinations/templates/notifications)', () => {
    const stats = MOCK_SOCIAL_STATS['30d']
    expect(Object.keys(stats.kpis).sort()).toEqual([
      'avgPerDay',
      'failed',
      'published',
      'scheduledUpcoming',
    ])
    expect(Object.keys(stats.destinations).sort()).toEqual(['active', 'total', 'verified'])
    expect(Object.keys(stats.templates).sort()).toEqual(['notification', 'post'])
    expect(Object.keys(stats.notifications).sort()).toEqual(['failed', 'sent'])
  })

  it('لا ينتج NaN في avgPerDay', () => {
    for (const range of ranges) {
      expect(Number.isFinite(MOCK_SOCIAL_STATS[range].kpis.avgPerDay)).toBe(true)
    }
  })
})
