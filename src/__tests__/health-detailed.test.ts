/**
 * Phase 2 Task 5 — /api/health/detailed: admin gate, rate limit, aggregation.
 * All backends mocked (no network/DB).
 */
import { AuthError } from '@/lib/auth'

const mockRequireAdmin = jest.fn()
jest.mock('@/lib/auth', () => {
  class MockAuthError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.name = 'AuthError'
      this.status = status
    }
  }
  return { AuthError: MockAuthError, requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }
})

const mockRateLimit = jest.fn()
jest.mock('@/lib/rate-limit', () => ({
  rateLimit: (...a: unknown[]) => mockRateLimit(...a),
  rateLimitHeaders: () => ({}),
  rateLimitMiddleware: jest.fn(),
}))

const mockQueryRaw = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) },
}))

const mockRedisGet = jest.fn()
jest.mock('@/lib/redis', () => ({
  redisGet: (...a: unknown[]) => mockRedisGet(...a),
  redisSet: jest.fn(),
  redisDel: jest.fn(),
  redisIncr: jest.fn(),
}))

jest.mock('@/lib/redis-circuit-breaker', () => ({
  getCircuitStatus: () => 'CLOSED (healthy)',
  isCircuitOpen: () => false,
}))

const mockVerifyBot = jest.fn()
jest.mock('@/lib/telegram-bot', () => ({
  verifyBot: (...a: unknown[]) => mockVerifyBot(...a),
}))

const mockVerifyBrevo = jest.fn()
jest.mock('@/lib/email/brevo', () => ({
  verifyBrevoSender: (...a: unknown[]) => mockVerifyBrevo(...a),
}))

jest.mock('@/lib/ia', () => ({
  isIaEnabled: () => true,
  isIaConfigured: () => true,
}))

import { GET } from '@/app/api/health/detailed/route'
import { NextRequest } from 'next/server'

function req() {
  return new NextRequest('http://x/api/health/detailed')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRateLimit.mockResolvedValue({ success: true, remaining: 9, resetAt: 0, limit: 10 })
  mockRequireAdmin.mockResolvedValue({ id: 'a1', role: 'admin' })
  mockQueryRaw.mockResolvedValue([{ '?column?': 1 }])
  mockRedisGet.mockResolvedValue(null)
  mockVerifyBot.mockResolvedValue({
    configured: true,
    botInfo: { username: 'TestBot', first_name: 'Test' },
  })
  mockVerifyBrevo.mockResolvedValue({ ok: true })
})

describe('GET /api/health/detailed', () => {
  it('returns 429 Arabic when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0, resetAt: 0, limit: 10 })
    const res = await GET(req())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(body.error.message).toMatch(/الحد المسموح/)
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Unauthorized', 401))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('returns 403 when non-admin', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Forbidden', 403))
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('returns healthy with all checks ok for admins', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('healthy')
    for (const key of ['database', 'redis', 'telegram', 'brevo', 'storage']) {
      expect(body.data.checks[key].status).toBe('ok')
    }
    // No secrets leak: webhook secret presence only, never the value.
    expect(body.data.checks.telegram.detail).toMatch(/webhook_secret:(set|missing)/)
    expect(JSON.stringify(body)).not.toMatch(/TELEGRAM_WEBHOOK_SECRET/)
  })

  it('returns degraded when a service is down', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    const body = await res.json()
    expect(body.data.status).toBe('degraded')
    expect(body.data.checks.database.status).toBe('error')
    expect(body.data.checks.redis.status).toBe('ok')
  })
})
