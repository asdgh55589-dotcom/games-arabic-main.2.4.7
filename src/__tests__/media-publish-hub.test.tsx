/**
 * @jest-environment jsdom
 */

import { cleanup, render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'test-id' }),
}))

const mockFetch = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = mockFetch as unknown as typeof fetch
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      user: { role: 'admin' },
    }),
  } as unknown as Response)
})

afterEach(() => cleanup())

describe('/admin/media/publish (Publishing Hub)', () => {
  it('renders tabs', () => {
    const Page = require('@/app/admin/media/publish/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-posts')).toBeTruthy()
    expect(screen.getByTestId('tab-archive')).toBeTruthy()
    expect(screen.getByTestId('tab-schedule')).toBeTruthy()
    expect(screen.getByTestId('tab-errors')).toBeTruthy()
  })

  it('shows Posts tab label', () => {
    const Page = require('@/app/admin/media/publish/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-posts').textContent).toContain('Posts')
  })

  it('shows new-post-button', () => {
    const Page = require('@/app/admin/media/publish/page').default
    render(<Page />)
    expect(screen.getByTestId('new-post-button')).toBeTruthy()
  })

  it('renders without crash', () => {
    const Page = require('@/app/admin/media/publish/page').default
    const { container } = render(<Page />)
    expect(container).toBeTruthy()
  })
})
