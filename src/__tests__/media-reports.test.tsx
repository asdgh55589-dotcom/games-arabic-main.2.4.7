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

const STATS = {
  range: '30d',
  kpis: { published: 42, failed: 3, scheduledUpcoming: 5, avgPerDay: 1.4 },
  timeSeries: [{ date: '2026-04-01', published: 10, failed: 1 }],
  destinations: { total: 2, active: 2, verified: 2 },
  templates: { notification: 6, post: 4 },
  notifications: { sent: 128, failed: 4 },
}

describe('/admin/media/reports (Reports)', () => {
  it('reads stats and shows KPIs', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: STATS }))
    const Page = require('@/app/admin/media/reports/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('مجدولة قادمة')).toBeTruthy(), WAIT)
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      '/api/admin/social/stats?platform=telegram',
    )
  })

  it('shows demo banner on API failure', async () => {
    mockFetch.mockReturnValue(Promise.reject(new Error('HTTP 500')))
    const Page = require('@/app/admin/media/reports/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('بيانات تجريبية')).toBeTruthy(), WAIT)
  })

  it('renders range buttons', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: STATS }))
    const Page = require('@/app/admin/media/reports/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('7 أيام')).toBeTruthy(), WAIT)
    expect(screen.getByText('30 يوماً')).toBeTruthy()
    expect(screen.getByText('90 يوماً')).toBeTruthy()
  })

  it('shows failed KPI', async () => {
    mockFetch.mockReturnValue(jsonResponse({ data: STATS }))
    const Page = require('@/app/admin/media/reports/page').default
    render(<Page />)

    await waitFor(() => expect(screen.getByText('فاشلة')).toBeTruthy(), WAIT)
  })
})
