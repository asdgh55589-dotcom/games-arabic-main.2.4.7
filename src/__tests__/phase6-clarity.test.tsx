/**
 * @jest-environment jsdom
 */
import { act, render } from '@testing-library/react'
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

  it('defers injection past first paint, then renders script tag', () => {
    jest.useFakeTimers()
    const restore = setClarityId('test-id-123')
    mockGetConsent.mockReturnValue('granted')
    try {
      let container: HTMLElement
      act(() => {
        ;({ container } = render(<ClarityScript />))
      })
      // Not part of the initial paint (deferred to idle):
      expect(container!.querySelector('script')).toBeNull()
      act(() => {
        jest.runAllTimers()
      })
      const script = container!.querySelector('script')
      expect(script).not.toBeNull()
      expect(script!.getAttribute('src')).toBeNull() // inline, no src attr
      expect(script!.innerHTML).toContain('clarity.ms/tag/')
    } finally {
      restore()
      jest.useRealTimers()
    }
  })

  it('contains PII masking: clarity("set", "user_id", null)', () => {
    jest.useFakeTimers()
    const restore = setClarityId('test-id-123')
    try {
      let container: HTMLElement
      act(() => {
        ;({ container } = render(<ClarityScript />))
      })
      act(() => {
        jest.runAllTimers()
      })
      const script = container!.querySelector('script')!
      expect(script.innerHTML).toContain('clarity("set", "user_id", null)')
    } finally {
      restore()
      jest.useRealTimers()
    }
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
