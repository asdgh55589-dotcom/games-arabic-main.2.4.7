/**
 * @jest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import * as React from 'react'

jest.mock('next/navigation', () => ({
  usePathname: () => '/creator',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: null, loading: false, error: null, refresh: jest.fn(), logout: jest.fn() }),
}))

beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })) as unknown as typeof window.matchMedia
  }
  Object.defineProperty(window, 'innerWidth', { value: 375, writable: true })
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { count: 0 } }),
  } as unknown as Response)
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
})

import { StudioLanguageProvider } from '@/lib/studio-i18n/context'
import { StudioShell } from '@/components/creator-dashboard/studio-shell'

function renderShell(children: React.ReactNode = <div data-testid="child">content</div>) {
  return render(
    <StudioLanguageProvider>
      <StudioShell user={{ name: 'tester', email: 't@x.com', avatar: '' }}>
        {children}
      </StudioShell>
    </StudioLanguageProvider>,
  )
}

describe('mobile nav (creator studio)', () => {
  it('renders SiteHeader in the studio shell', () => {
    renderShell()
    expect(screen.getByText('لوحة التحكم')).toBeTruthy()
  })

  it('renders a sidebar trigger button for mobile navigation', () => {
    renderShell()
    expect(screen.getByRole('button', { name: /toggle sidebar/i })).toBeTruthy()
  })

  it('sidebar trigger meets the 44px touch-target minimum', () => {
    renderShell()
    const trigger = screen.getByRole('button', { name: /toggle sidebar/i })
    expect(trigger.className).toContain('min-h-[44px]')
    expect(trigger.className).toContain('min-w-[44px]')
  })

  it('renders page children alongside the header', () => {
    renderShell(<div data-testid="child">hello</div>)
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('renders the header user menu trigger', () => {
    renderShell()
    expect(screen.getByRole('button', { name: /قائمة المستخدم/i })).toBeTruthy()
  })

  it('renders the notifications button', () => {
    renderShell()
    expect(screen.getByRole('button', { name: /الإشعارات/i })).toBeTruthy()
  })
})
