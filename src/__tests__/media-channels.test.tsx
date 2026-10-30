/**
 * @jest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockFetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: [] }),
  } as unknown as Response)
})

afterEach(() => cleanup())

describe('/admin/media/channels (Channels)', () => {
  it('renders all three tabs', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-platforms')).toBeTruthy()
    expect(screen.getByTestId('tab-destinations')).toBeTruthy()
    expect(screen.getByTestId('tab-routing')).toBeTruthy()
  })

  it('shows platforms content with قنوات', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(<Page />)
    expect(screen.getByText('قنوات')).toBeTruthy()
  })

  it('tab-platforms label is Platforms', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-platforms').textContent).toContain('Platforms')
  })

  it('tab-destinations label is Destinations', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-destinations').textContent).toContain('Destinations')
  })

  it('tab-routing label is Routing', () => {
    const Page = require('@/app/admin/media/channels/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-routing').textContent).toContain('Routing')
  })
})
