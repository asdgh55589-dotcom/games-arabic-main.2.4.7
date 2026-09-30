/**
 * Phase 3 — DbMonitor: pool metrics parsing, thresholds, fail-open behavior.
 */
const mockQueryRaw = jest.fn()
jest.mock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
const mockReportError = jest.fn()
jest.mock('@/lib/error-reporting', () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }))

import { DbMonitor } from '@/lib/observability/db-monitor'

function healthyRows() {
  mockQueryRaw
    .mockResolvedValueOnce([
      { state: 'active', count: 2 },
      { state: 'idle', count: 3 },
    ])
    .mockResolvedValueOnce([{ max: 20 }])
    .mockResolvedValueOnce([{ query: 'SELECT 1', duration: 0.01 }])
}

beforeEach(() => {
  jest.clearAllMocks()
  DbMonitor.resetThrottle()
})

describe('DbMonitor.getMetrics', () => {
  it('parses pg_stat_activity into pool metrics', async () => {
    healthyRows()
    const m = await DbMonitor.getMetrics()
    expect(m).not.toBeNull()
    expect(m!.activeConnections).toBe(2)
    expect(m!.idleConnections).toBe(3)
    expect(m!.totalConnections).toBe(5)
    expect(m!.maxConnections).toBe(20)
    expect(m!.poolUsagePercent).toBe(40)
    expect(m!.oldestQueryS).toBeCloseTo(0.01)
  })

  it('throttles to one collection per 30s (second call returns null)', async () => {
    healthyRows()
    expect(await DbMonitor.getMetrics()).not.toBeNull()
    expect(await DbMonitor.getMetrics()).toBeNull()
    expect(mockQueryRaw).toHaveBeenCalledTimes(3)
  })

  it('fail-open: probe failure returns null, never throws', async () => {
    mockQueryRaw.mockRejectedValue(new Error('db down'))
    await expect(DbMonitor.getMetrics()).resolves.toBeNull()
  })

  it('getCachedOrCollect serves last-good sample as stale instead of flapping', async () => {
    healthyRows()
    const fresh = await DbMonitor.getCachedOrCollect()
    expect(fresh.stale).toBe(false)
    expect(fresh.metrics!.poolUsagePercent).toBe(40)
    // throttled now — falls back to last good
    const stale = await DbMonitor.getCachedOrCollect()
    expect(stale.stale).toBe(true)
    expect(stale.metrics!.poolUsagePercent).toBe(40)
  })

  it('getCachedOrCollect reports unknown when nothing was ever collected', async () => {
    DbMonitor.resetThrottle()
    DbMonitor.resetCache()
    mockQueryRaw.mockRejectedValue(new Error('db down'))
    // first call fails (null, nothing cached)...
    expect(await DbMonitor.getCachedOrCollect()).toEqual({ metrics: null, stale: false })
  })
})

describe('DbMonitor.checkHealth', () => {
  it('healthy when pool low and queries fast (no Sentry)', async () => {
    healthyRows()
    const h = await DbMonitor.checkHealth()
    expect(h).toEqual({ healthy: true, issues: [] })
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('alerts Sentry when pool usage exceeds 80%', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { state: 'active', count: 17 },
        { state: 'idle', count: 2 },
      ])
      .mockResolvedValueOnce([{ max: 20 }])
      .mockResolvedValueOnce([])
    const h = await DbMonitor.checkHealth()
    expect(h.healthy).toBe(false)
    expect(h.issues.join(' ')).toMatch(/100%/)
    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('flags queries running longer than 5s', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ state: 'active', count: 1 }])
      .mockResolvedValueOnce([{ max: 20 }])
      .mockResolvedValueOnce([{ query: 'SELECT pg_sleep(9)', duration: 9.2 }])
    const h = await DbMonitor.checkHealth()
    expect(h.healthy).toBe(false)
    expect(h.issues.join(' ')).toMatch(/9\.2s/)
  })
})
