/**
 * @jest-environment jsdom
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}))

jest.mock('@/components/admin/social/telegram-stats', () => ({
  TelegramByDayChart: () => null,
  TelegramDestinations: () => null,
}))

const mockFetch = jest.fn()
const WAIT = { timeout: 10000 }
jest.setTimeout(30000)

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
  mockFetch.mockImplementation((url: string) => {
    const u = String(url)
    if (u.includes('/overview')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: OVERVIEW }),
      } as Response)
    }
    if (u.includes('/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ data: STATS }),
      } as Response)
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        user: { role: 'admin' },
      }),
    } as Response)
  })
})

afterEach(() => cleanup())

const OVERVIEW = {
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
  nextScheduled: [],
  recentPublished: [],
}

const STATS = {
  range: '30d',
  kpis: { published: 42, failed: 3, scheduledUpcoming: 5, avgPerDay: 1.4 },
  timeSeries: [{ date: '2026-04-01', published: 10, failed: 1 }],
  destinations: { total: 2, active: 2, verified: 2 },
  templates: { notification: 6, post: 4 },
  notifications: { sent: 128, failed: 4 },
}

const root = process.cwd()

function read(p: string): string {
  return fs.readFileSync(path.join(root, p), 'utf8')
}

describe('Media consolidation integration', () => {
  it('all five new page files exist', () => {
    const pages = [
      'src/app/admin/media/page.tsx',
      'src/app/admin/media/publish/page.tsx',
      'src/app/admin/media/reports/page.tsx',
      'src/app/admin/media/assets/page.tsx',
      'src/app/admin/media/channels/page.tsx',
    ]
    for (const pg of pages) {
      expect(fs.existsSync(path.join(root, pg))).toBe(true)
    }
  })

  it('renders media overview page', async () => {
    const Page = require('@/app/admin/media/page').default
    render(React.createElement(Page))
    await waitFor(() => expect(screen.getByText('المنصات')).toBeTruthy(), WAIT)
  })

  it('renders publish hub with tabs', () => {
    const Page = require('@/app/admin/media/publish/page').default
    render(React.createElement(Page))
    expect(screen.getByTestId('tab-posts')).toBeTruthy()
    expect(screen.getByTestId('tab-archive')).toBeTruthy()
    expect(screen.getByTestId('tab-schedule')).toBeTruthy()
    expect(screen.getByTestId('tab-errors')).toBeTruthy()
  })

  it('renders reports page', async () => {
    const Page = require('@/app/admin/media/reports/page').default
    render(React.createElement(Page))
    await waitFor(() => expect(screen.getByText('مجدولة قادمة')).toBeTruthy(), WAIT)
  })

  it('renders assets page with tabs', () => {
    const Page = require('@/app/admin/media/assets/page').default
    render(React.createElement(Page))
    expect(screen.getByTestId('tab-active')).toBeTruthy()
    expect(screen.getByTestId('tab-archived')).toBeTruthy()
  })

  it('renders channels page with tabs', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(React.createElement(Page))
    expect(screen.getByTestId('tab-platforms')).toBeTruthy()
    expect(screen.getByTestId('tab-destinations')).toBeTruthy()
    expect(screen.getByTestId('tab-routing')).toBeTruthy()
  })

  it('next.config.ts declares media consolidation redirects', () => {
    const src = read('next.config.ts')
    expect(src).toContain('Media consolidation (301)')
    const redirects = [
      ['/admin/social', '/admin/media'],
      ['/admin/social/telegram/posts', '/admin/media/publish'],
      ['/admin/publish/schedule', '/admin/media/publish?tab=schedule'],
    ]
    for (const [source, destination] of redirects) {
      expect(src).toContain(`source: '${source}'`)
      expect(src).toContain(`destination: '${destination}'`)
    }
  })

  it('role gating entries present in admin-pages.ts', () => {
    const src = read('src/lib/admin-pages.ts')
    expect(src).toContain("p('/admin/media', 'نظرة عامة', 'admin')")
    expect(src).toContain("p('/admin/media/assets', 'الأصول', 'manager')")
    expect(src).toContain("p('/admin/media/publish', 'النشر', 'manager')")
    expect(src).toContain("p('/admin/media/reports', 'التقارير', 'admin')")
  })

  it('query params supported in consolidated clients', () => {
    const publish = read('src/components/admin/media/PublishHubClient.tsx')
    const assets = read('src/components/admin/media/AssetsClient.tsx')
    const channels = read('src/components/admin/media/ChannelsClient.tsx')
    expect(publish).toContain("searchParams?.get('tab')")
    expect(publish).toContain("searchParams?.get('new')")
    expect(publish).toContain("searchParams?.get('help')")
    expect(assets).toContain("searchParams?.get('tab')")
    expect(channels).toContain("searchParams?.get('tab')")
  })

  it('lazy loading uses next/dynamic in consolidated clients', () => {
    const publish = read('src/components/admin/media/PublishHubClient.tsx')
    const assets = read('src/components/admin/media/AssetsClient.tsx')
    const channels = read('src/components/admin/media/ChannelsClient.tsx')
    expect(publish).toContain('dynamic(')
    expect(assets).toContain('dynamic(')
    expect(channels).toContain('dynamic(')
  })
})
