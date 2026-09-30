/**
 * Phase 3 — GET /api/admin/db/monitoring: admin gate, rate limit, payload shape.
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
}))

jest.mock('@/lib/db', () => ({
  db: {},
  isConnectionHealthy: () => true,
}))

const mockGetMetrics = jest.fn()
const mockCheckHealth = jest.fn()
const mockCachedOrCollect = jest.fn()
jest.mock('@/lib/observability/db-monitor', () => ({
  DbMonitor: {
    getMetrics: (...a: unknown[]) => mockGetMetrics(...a),
    checkHealth: (...a: unknown[]) => mockCheckHealth(...a),
    getCachedOrCollect: (...a: unknown[]) => mockCachedOrCollect(...a),
  },
}))

jest.mock('@/lib/observability/db-circuit-breaker', () => ({
  dbCircuitBreaker: { getState: () => ({ state: 'CLOSED', failureCount: 0 }) },
}))

import { GET } from '@/app/api/admin/db/monitoring/route'
import { NextRequest } from 'next/server'

function req() {
  return new NextRequest('http://x/api/admin/db/monitoring')
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRateLimit.mockResolvedValue({ success: true })
  mockRequireAdmin.mockResolvedValue({ id: 'a1', role: 'admin' })
  mockGetMetrics.mockResolvedValue({ poolUsagePercent: 25, totalConnections: 5 })
  mockCheckHealth.mockResolvedValue({ healthy: true, issues: [] })
  mockCachedOrCollect.mockResolvedValue({
    metrics: { poolUsagePercent: 25, totalConnections: 5 },
    stale: false,
  })
})

describe('GET /api/admin/db/monitoring', () => {
  it('returns 429 when rate limited', async () => {
    mockRateLimit.mockResolvedValue({ success: false })
    const res = await GET(req())
    expect(res.status).toBe(429)
  })

  it('returns 401 when unauthenticated, 403 when non-admin', async () => {
    mockRequireAdmin.mockRejectedValueOnce(new AuthError('Unauthorized', 401))
    expect((await GET(req())).status).toBe(401)
    mockRequireAdmin.mockRejectedValueOnce(new AuthError('Forbidden', 403))
    expect((await GET(req())).status).toBe(403)
  })

  it('returns metrics + breaker state for admins, single collection shared', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('healthy')
    expect(body.data.metrics.poolUsagePercent).toBe(25)
    expect(body.data.stale).toBe(false)
    expect(body.data.circuitBreaker.state).toBe('CLOSED')
    expect(body.data.connectionHealthy).toBe(true)
    expect(body.data.time).toBeDefined()
    // checkHealth receives the already-collected metrics (no double probe)
    expect(mockCheckHealth).toHaveBeenCalledWith({ poolUsagePercent: 25, totalConnections: 5 })
  })

  it('serves stale sample instead of flapping degraded on throttle', async () => {
    mockCachedOrCollect.mockResolvedValue({
      metrics: { poolUsagePercent: 25, totalConnections: 5 },
      stale: true,
    })
    const body = await (await GET(req())).json()
    expect(body.data.status).toBe('healthy')
    expect(body.data.stale).toBe(true)
    expect(body.data.metrics.poolUsagePercent).toBe(25)
  })

  it('reports unknown (not degraded) when nothing was ever collected', async () => {
    mockCachedOrCollect.mockResolvedValue({ metrics: null, stale: false })
    const body = await (await GET(req())).json()
    expect(body.data.status).toBe('unknown')
    expect(body.data.metrics).toBeNull()
  })

  it('reports degraded when health has issues', async () => {
    mockCheckHealth.mockResolvedValue({ healthy: false, issues: ['Pool usage at 95% (>80%)'] })
    const body = await (await GET(req())).json()
    expect(body.data.status).toBe('degraded')
    expect(body.data.issues).toHaveLength(1)
  })
})
