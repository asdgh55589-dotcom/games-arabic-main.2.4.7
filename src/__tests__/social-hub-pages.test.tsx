/**
 * @jest-environment jsdom
 *
 * اختبارات صفحتي مركز السوشيال: اللمحة ومركز تليجرام.
 * نتحقق من العقد مع الخادم (الـ URL)، سقوط البيانات التجريبية عند فشل الـ API،
 * والروابط السريعة — بلا assertions على أصناف CSS.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { SocialOverviewData, SocialStatsData } from '@/hooks/use-social'

// نتجنّب تحميل recharts في jsdom: نستبدل مخطط تليجرام بمكوّن وهمي.
jest.mock('@/components/admin/social/telegram-stats', () => ({
  TelegramByDayChart: () => <div data-testid="chart" />,
  TelegramDestinations: () => <div data-testid="destinations" />,
}))

const mockFetch = jest.fn()
const WAIT = { timeout: 10000 }

// أول تشغيل يجمّع ts-jest عدّة ملفات بالتوازي، فتتجاوز المهلة الافتراضية (5s).
jest.setTimeout(20000)

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => cleanup())

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response)
}

const STATS: SocialStatsData = {
  range: '30d',
  kpis: { published: 42, failed: 3, scheduledUpcoming: 5, avgPerDay: 1.4 },
  timeSeries: [{ date: '2026-04-01', published: 10, failed: 1 }],
  destinations: { total: 2, active: 2, verified: 2 },
  templates: { notification: 6, post: 4 },
  notifications: { sent: 128, failed: 4 },
}

const OVERVIEW: SocialOverviewData = {
  totals: { published30d: 42, scheduled: 5, failed: 3 },
  platforms: [
    {
      key: 'telegram',
      status: 'active',
      destinations: 2,
      templates: 4,
      posts: { published30d: 42, scheduled: 5, failed: 3 },
    },
  ],
  nextScheduled: [
    {
      id: 'post-1',
      platform: 'telegram',
      title: 'منشور قادم',
      scheduledFor: '2026-04-10T09:00:00.000Z',
    },
  ],
  recentPublished: [
    {
      id: 'post-2',
      platform: 'telegram',
      title: 'منشور سابق',
      publishedAt: '2026-04-01T09:00:00.000Z',
      externalId: '8241',
    },
  ],
}

describe('/admin/social (اللمحة)', () => {
  it('يقرأ اللمحة من نقطة النهاية يعرض شبكة المنصات', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: OVERVIEW }))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Page = require('@/app/admin/social/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('المنصات')).toBeTruthy(), WAIT)
    expect(String(mockFetch.mock.calls[0][0])).toBe('/api/admin/social/overview')
    expect(screen.getAllByText('تليجرام').length).toBeGreaterThan(0)
    expect(screen.getAllByText('فيسبوك').length).toBeGreaterThan(0)
    expect(screen.getAllByText('يوتيوب').length).toBeGreaterThan(0)
    // بيانات حقيقية: لا يظهر شريط البيانات التجريبية.
    expect(screen.queryByText('بيانات تجريبية')).toBeNull()
  })

  it('يعرض شريط البيانات التجريبية عند فشل الـ API', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('HTTP 404')))
    const Page = require('@/app/admin/social/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('بيانات تجريبية')).toBeTruthy(), WAIT)
  })
})

describe('/admin/social/telegram (المركز)', () => {
  it('يقرأ الإحصاءات ويربط «سجل إشعارات تيليجرام» بفلتر القناة', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: STATS }))
    const Page = require('@/app/admin/social/telegram/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('مجدولة قادمة')).toBeTruthy(), WAIT)
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      '/api/admin/social/stats?platform=telegram',
    )
    const link = screen.getByText('سجل إشعارات تيليجرام').closest('a')
    expect(link?.getAttribute('href')).toBe('/admin/notifications/history?channel=telegram')
  })

  it('يسقط على بيانات تجريبية مع شريط توضيحي عند فشل الـ API', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('HTTP 500')))
    const Page = require('@/app/admin/social/telegram/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('بيانات تجريبية')).toBeTruthy(), WAIT)
  })
})
