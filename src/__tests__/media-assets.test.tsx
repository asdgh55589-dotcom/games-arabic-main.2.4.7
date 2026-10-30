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

describe('/admin/media/assets (Assets)', () => {
  it('renders tabs', () => {
    const Page = require('@/app/admin/media/assets/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-active')).toBeTruthy()
    expect(screen.getByTestId('tab-archived')).toBeTruthy()
  })

  it('shows Active tab label', () => {
    const Page = require('@/app/admin/media/assets/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-active').textContent).toContain('Active')
  })

  it('shows Archived tab label', () => {
    const Page = require('@/app/admin/media/assets/page').default
    render(<Page />)
    expect(screen.getByTestId('tab-archived').textContent).toContain('Archived')
  })
})
