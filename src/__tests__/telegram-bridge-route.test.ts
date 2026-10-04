/**
 * Regression test for POST /api/auth/telegram-bridge.
 *
 * Bug: the handler passed `ipAddress: bridgeIp` to performTelegramLogin, but
 * `bridgeIp` was never declared anywhere in the module → TS2304 and, at
 * runtime, a ReferenceError thrown BEFORE the login call → every validly
 * signed widget payload got a 500 (login via the Telegram widget was dead).
 *
 * This test exercises the real route handler with a valid signed payload and
 * asserts it does NOT 500 and DOES reach performTelegramLogin with the
 * client IP derived from x-forwarded-for.
 */

import { NextRequest } from 'next/server'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

jest.mock('@/lib/error-reporting', () => ({
  reportError: jest.fn(),
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(),
  rateLimitHeaders: jest.fn().mockReturnValue({}),
}))

jest.mock('@/lib/telegram-verify', () => ({
  verifyTelegramAuth: jest.fn().mockReturnValue(true),
  isAuthDateValid: jest.fn().mockReturnValue(true),
}))

const mockPerformTelegramLogin = jest.fn()
jest.mock('@/lib/telegram-login', () => ({
  performTelegramLogin: (...a: Array<any>) => mockPerformTelegramLogin(...a),
}))

import { POST } from '@/app/api/auth/telegram-bridge/route'
import { rateLimit } from '@/lib/rate-limit'

const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>

function signedPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: '777000',
    first_name: 'Test',
    username: 'tester',
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: 'a'.repeat(64),
    ...overrides,
  }
}

function bridgeReq(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://x/api/auth/telegram-bridge', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/telegram-bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
    } as any)
    mockPerformTelegramLogin.mockResolvedValue({
      ok: true,
      user: { id: 'u-1', username: 'tester' },
      ledgerToken: 'ledger-token',
      ledgerExpires: new Date(Date.now() + 86_400_000),
    })
  })

  it('valid signed payload does not 500 (regression: undefined bridgeIp ReferenceError)', async () => {
    const res = await POST(bridgeReq(signedPayload()))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      redirectTo: '/',
    })
  })

  it('passes the first x-forwarded-for hop as ipAddress and sets the ledger cookie', async () => {
    const res = await POST(
      bridgeReq(signedPayload(), {
        'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        'user-agent': 'jest',
      }),
    )

    expect(res.status).toBe(200)
    expect(mockPerformTelegramLogin).toHaveBeenCalledTimes(1)
    const [userData, ctx] = mockPerformTelegramLogin.mock.calls[0]
    expect(userData).toMatchObject({ telegramId: 777000, username: 'tester' })
    expect(ctx.ipAddress).toBe('203.0.113.7')
    expect(ctx.userAgent).toBe('jest')
    expect(res.cookies.get('ga_session_ledger')?.value).toBe('ledger-token')
  })

  it('falls back to x-real-ip then null without throwing', async () => {
    await POST(bridgeReq(signedPayload(), { 'user-agent': 'jest' }))
    expect(mockPerformTelegramLogin.mock.calls[0][1].ipAddress).toBeNull()

    mockPerformTelegramLogin.mockClear()
    await POST(bridgeReq(signedPayload(), { 'x-real-ip': '198.51.100.4' }))
    expect(mockPerformTelegramLogin.mock.calls[0][1].ipAddress).toBe('198.51.100.4')
  })

  it('rejects an invalid signature with 401 and never calls the login helper', async () => {
    const { verifyTelegramAuth } = await import('@/lib/telegram-verify')
    ;(verifyTelegramAuth as jest.Mock).mockReturnValueOnce(false)

    const res = await POST(bridgeReq(signedPayload({ hash: 'deadbeef' })))

    expect(res.status).toBe(401)
    expect(mockPerformTelegramLogin).not.toHaveBeenCalled()
  })

  it('returns 429 with rate-limit headers when the limiter trips', async () => {
    mockRateLimit.mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    } as any)

    const res = await POST(bridgeReq(signedPayload()))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockPerformTelegramLogin).not.toHaveBeenCalled()
  })
})
