/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react'
import { ClarityScript } from '@/components/clarity-script'

const mockGetConsent = jest.fn()

jest.mock('@/lib/consent', () => ({
  getConsent: (...args: unknown[]) => mockGetConsent(...args),
}))

function setClarityId(id: string | undefined) {
  const env = process.env as Record<string, string | undefined>
  const prev = env.NEXT_PUBLIC_CLARITY_ID
  if (id === undefined) {
    delete env.NEXT_PUBLIC_CLARITY_ID
  } else {
    env.NEXT_PUBLIC_CLARITY_ID = id
  }
  return () => {
    if (prev === undefined) {
      delete env.NEXT_PUBLIC_CLARITY_ID
    } else {
      env.NEXT_PUBLIC_CLARITY_ID = prev
    }
  }
}

beforeEach(() => {
  jest.restoreAllMocks()
  mockGetConsent.mockReturnValue('granted')
})

describe('ClarityScript', () => {
  it('renders nothing when NEXT_PUBLIC_CLARITY_ID is not set', () => {
    const restore = setClarityId(undefined)
    const { container } = render(<ClarityScript />)
    expect(container.innerHTML).toBe('')
    restore()
  })

  it('renders nothing when consent is denied', () => {
    const restore = setClarityId('test-id-123')
    mockGetConsent.mockReturnValue('denied')
    const { container } = render(<ClarityScript />)
    expect(container.innerHTML).toBe('')
    restore()
  })

  it('renders script tag when ID set AND consent granted', () => {
    const restore = setClarityId('test-id-123')
    mockGetConsent.mockReturnValue('granted')
    const { container } = render(<ClarityScript />)
    const script = container.querySelector('script')
    expect(script).not.toBeNull()
    expect(script!.getAttribute('src')).toBeNull() // inline, no src attr
    expect(script!.innerHTML).toContain('clarity.ms/tag/')
    restore()
  })

  it('contains PII masking: clarity("set", "user_id", null)', () => {
    const restore = setClarityId('test-id-123')
    const { container } = render(<ClarityScript />)
    const script = container.querySelector('script')!
    expect(script.innerHTML).toContain('clarity("set", "user_id", null)')
    restore()
  })

  it('does NOT leak clarity ID to console/logs', () => {
    const restore = setClarityId('secret-id-999')
    const consoleSpy = jest.spyOn(console, 'log')
    render(<ClarityScript />)
    for (const call of consoleSpy.mock.calls) {
      const msg = call.join(' ')
      expect(msg).not.toContain('secret-id-999')
    }
    consoleSpy.mockRestore()
    restore()
  })
})
