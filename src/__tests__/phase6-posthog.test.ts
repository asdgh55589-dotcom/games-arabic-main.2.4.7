import { AnalyticsEvents } from '@/lib/analytics/events'

// Mock localStorage for Node.js test environment
let store: Record<string, string> = {}
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key]
  }),
  clear: jest.fn(() => {
    store = {}
  }),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: { localStorage: localStorageMock },
  writable: true,
  configurable: true,
})

describe('consent', () => {
  beforeEach(() => {
    store = {}
    jest.clearAllMocks()
  })

  it('defaults to granted when localStorage empty', () => {
    const { getConsent } = require('@/lib/consent')
    expect(getConsent()).toBe('granted')
  })

  it('setConsent persists and getConsent reads it', () => {
    const { setConsent, getConsent } = require('@/lib/consent')
    setConsent('denied')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('analytics_consent', 'denied')
    expect(getConsent()).toBe('denied')
  })

  it('isTrackingAllowed returns true/false correctly', () => {
    const { isTrackingAllowed, setConsent } = require('@/lib/consent')
    expect(isTrackingAllowed()).toBe(true)
    setConsent('denied')
    expect(isTrackingAllowed()).toBe(false)
    setConsent('granted')
    expect(isTrackingAllowed()).toBe(true)
  })
})

describe('AnalyticsEvents', () => {
  it('has all required events', () => {
    expect(AnalyticsEvents.PAGE_VIEW).toBe('page_view')
    expect(AnalyticsEvents.SIGNUP).toBe('signup')
    expect(AnalyticsEvents.MOD_PUBLISHED).toBe('mod_published')
    expect(AnalyticsEvents.COMMENT_POSTED).toBe('comment_posted')
    expect(AnalyticsEvents.DOWNLOAD_STARTED).toBe('download_started')
    expect(AnalyticsEvents.CREATOR_APPLIED).toBe('creator_applied')
    expect(AnalyticsEvents.LOGIN_SUCCESS).toBe('login_success')
  })
})

describe('posthog client', () => {
  const mockCapture = jest.fn()
  const mockOptOut = jest.fn()
  const mockIdentify = jest.fn()
  const mockInit = jest.fn()

  beforeEach(() => {
    jest.resetModules()
    jest.doMock('posthog-js', () => ({
      __esModule: true,
      default: {
        init: mockInit,
        capture: mockCapture,
        opt_out_capturing: mockOptOut,
        identify: mockIdentify,
      },
    }))
    jest.doMock('@/lib/consent', () => ({
      getConsent: jest.fn(() => 'granted'),
    }))
    mockCapture.mockClear()
    mockOptOut.mockClear()
    mockIdentify.mockClear()
    mockInit.mockClear()
  })

  it('initPostHog no-ops when key missing', () => {
    const original = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''
    delete (process.env as Record<string, string>).NEXT_PUBLIC_POSTHOG_KEY

    const { initPostHog } = require('@/lib/analytics/posthog')
    initPostHog()
    expect(mockInit).not.toHaveBeenCalled()

    ;(process.env as Record<string, string>).NEXT_PUBLIC_POSTHOG_KEY = original
  })

  it('posthogCapture wraps posthog.capture', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
    const { posthogCapture } = require('@/lib/analytics/posthog')
    posthogCapture('test_event', { foo: 'bar' })
    expect(mockCapture).toHaveBeenCalledWith('test_event', { foo: 'bar' })
  })

  it('identifyPosthog hashes userId', () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
    const { identifyPosthog } = require('@/lib/analytics/posthog')
    identifyPosthog('user-123456')
    expect(mockIdentify).toHaveBeenCalled()
    const calledWith = mockIdentify.mock.calls[0][0]
    expect(calledWith).not.toBe('user-123456')
    expect(calledWith).toMatch(/^u_/)
  })
})

describe('posthog server', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getPostHogServer returns null when key missing', () => {
    const original = process.env.POSTHOG_API_KEY ?? ''
    delete (process.env as Record<string, string>).POSTHOG_API_KEY

    jest.doMock('posthog-node', () => ({
      PostHog: jest.fn(),
    }))

    const { getPostHogServer } = require('@/lib/analytics/posthog-server')
    const result = getPostHogServer()
    expect(result).toBeNull()

    ;(process.env as Record<string, string>).POSTHOG_API_KEY = original
  })
})
