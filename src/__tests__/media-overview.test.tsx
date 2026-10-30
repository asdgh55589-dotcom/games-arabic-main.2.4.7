/**
 * @jest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react'

jest.mock('@/components/admin/social/telegram-stats', () => ({
  TelegramByDayChart: () => <div data-testid="chart" />,
  TelegramDestinations: () => <div data-testid="destinations" />,
}))

const mockFetch = jest.fn()
const WAIT = { timeout: 10000 }

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

describe('/admin/media (Overview)', () => {
  it('reads overview and shows platforms grid', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: OVERVIEW }))
    const Page = require('@/app/admin/media/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('المنصات')).toBeTruthy(), WAIT)
    expect(String(mockFetch.mock.calls[0][0])).toBe('/api/admin/social/overview')
    expect(screen.getAllByText('تليجرام').length).toBeGreaterThan(0)
    expect(screen.queryByText('بيانات تجريبية')).toBeNull()
  })

  it('shows demo banner on API failure', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('HTTP 404')))
    const Page = require('@/app/admin/media/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('بيانات تجريبية')).toBeTruthy(), WAIT)
  })

  it('renders stat cards', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: OVERVIEW }))
    const Page = require('@/app/admin/media/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('المنصات')).toBeTruthy(), WAIT)
    expect(screen.getByText('منشورات (30 يوماً)')).toBeTruthy()
  })
})
