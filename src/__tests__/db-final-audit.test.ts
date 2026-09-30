/**
 * FINAL AUDIT — database system cross-cutting guarantees.
 *
 * Unlike the per-phase suites (which pin individual behaviors), these tests
 * assert SYSTEM properties: one pool per process, correct params in every
 * config surface, monitor/breaker defaults, cache round-trips, bounded
 * sitemap queries, and the admin endpoint's degraded path.
 * No real DB is touched (Prisma + Redis are mocked or in-memory fallback).
 */
import * as fs from 'fs'
import * as path from 'path'

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({})),
}))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))
const mockReportError = jest.fn()
jest.mock('@/lib/error-reporting', () => ({ reportError: (...a: unknown[]) => mockReportError(...a) }))

import { ensureSslmode, isConnectionHealthy, withDatabaseRetry, db } from '@/lib/db'

const ROOT = process.cwd()

/** Parse `KEY="postgresql://...?...` params from a dotenv file (null if absent). */
function urlParams(file: string, key: string): URLSearchParams | null {
  const p = path.join(ROOT, file)
  if (!fs.existsSync(p)) return null
  const line = fs
    .readFileSync(p, 'utf-8')
    .split('\n')
    .find((l) => l.startsWith(`${key}=`))
  if (!line) return null
  const raw = line.slice(key.length + 1).trim().replace(/^"|"$/g, '')
  try {
    return new URL(raw).searchParams
  } catch {
    return null
  }
}

describe('AUDIT connection & pool (1-5)', () => {
  it('1. singleton PrismaClient is shared across imports (one pool per process)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const again = require('@/lib/db').db
    expect(again).toBe(db)
    expect((globalThis as unknown as { prisma?: unknown }).prisma).toBe(db)
  })

  it('2. connection_limit=5 in code defaults AND every committed/local env file', () => {
    expect(new URL(ensureSslmode('postgresql://u:p@h:5432/d?sslmode=require')).searchParams.get('connection_limit')).toBe('5')
    for (const f of ['.env.example', '.env', '.env.local']) {
      for (const k of ['DATABASE_URL', 'AIVEN_DATABASE_URL']) {
        const params = urlParams(f, k)
        if (!params) continue
        expect(`${f} ${k}`).toBeDefined()
        expect(params.get('connection_limit')).toBe('5')
      }
    }
  })

  it('3. pool_timeout=10 fail-fast default (never the old 60s hang)', () => {
    const p = new URL(ensureSslmode('postgresql://u:p@h:5432/d?sslmode=require')).searchParams
    expect(p.get('pool_timeout')).toBe('10')
    expect(p.get('connect_timeout')).toBe('10')
  })

  it('4. statement_timeout=15000 injected when missing, preserved when set', () => {
    const injected = new URL(ensureSslmode('postgresql://u:p@h:5432/d?sslmode=require')).searchParams
    expect(injected.get('statement_timeout')).toBe('15000')
    const kept = new URL(
      ensureSslmode('postgresql://u:p@h:5432/d?sslmode=require&statement_timeout=7000'),
    ).searchParams
    expect(kept.get('statement_timeout')).toBe('7000')
  })

  it('5. sslmode=require enforced: rejects disable/allow/prefer/verify-ca, injects when absent', () => {
    const base = 'postgresql://u:p@h:5432/d'
    for (const bad of ['disable', 'allow', 'prefer', 'verify-ca', 'verify-full']) {
      expect(() => ensureSslmode(`${base}?sslmode=${bad}`)).toThrow(/sslmode=require/)
    }
    expect(new URL(ensureSslmode(base)).searchParams.get('sslmode')).toBe('require')
  })
})

describe('AUDIT monitoring (6-8)', () => {
  const mockQueryRaw = jest.fn()
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('6. DbMonitor.getMetrics returns the full 7-key shape with numeric types', async () => {
    jest.resetModules()
    jest.doMock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }))
    const { DbMonitor } = require('@/lib/observability/db-monitor')
    DbMonitor.resetThrottle()
    mockQueryRaw
      .mockResolvedValueOnce([{ state: 'active', count: 1 }])
      .mockResolvedValueOnce([{ max: 20 }])
      .mockResolvedValueOnce([{ query: 'SELECT 1', duration: 0.05 }])
    const m = await DbMonitor.getMetrics()
    for (const k of [
      'activeConnections',
      'idleConnections',
      'totalConnections',
      'maxConnections',
      'poolUsagePercent',
      'oldestQueryS',
      'slowQueries',
    ]) {
      expect(m).toHaveProperty(k)
    }
    expect(typeof m.poolUsagePercent).toBe('number')
  })

  it('7. checkHealth flags 90% pool usage as exhausted', async () => {
    jest.resetModules()
    jest.doMock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }))
    const { DbMonitor } = require('@/lib/observability/db-monitor')
    DbMonitor.resetThrottle()
    mockQueryRaw
      .mockResolvedValueOnce([{ state: 'active', count: 9 }])
      .mockResolvedValueOnce([{ max: 10 }])
      .mockResolvedValueOnce([])
    const h = await DbMonitor.checkHealth()
    expect(h.healthy).toBe(false)
    expect(h.issues.join(' ')).toMatch(/100%/)
  })

  it('8. resetThrottle re-enables collection after a throttled null', async () => {
    jest.resetModules()
    jest.doMock('@/lib/db', () => ({ db: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }))
    const { DbMonitor } = require('@/lib/observability/db-monitor')
    DbMonitor.resetThrottle()
    const rows = (extra: unknown[]) => {
      mockQueryRaw
        .mockResolvedValueOnce([{ state: 'active', count: 1 }])
        .mockResolvedValueOnce([{ max: 20 }])
        .mockResolvedValueOnce(extra)
    }
    rows([])
    expect(await DbMonitor.getMetrics()).not.toBeNull()
    expect(await DbMonitor.getMetrics()).toBeNull()
    DbMonitor.resetThrottle()
    rows([])
    expect(await DbMonitor.getMetrics()).not.toBeNull()
  })
})

describe('AUDIT circuit breaker defaults (9-11)', () => {
  it('9. exported singleton starts CLOSED with zero failures', async () => {
    const { dbCircuitBreaker } = require('@/lib/observability/db-circuit-breaker')
    dbCircuitBreaker.reset()
    expect(dbCircuitBreaker.getState()).toEqual({ state: 'CLOSED', failureCount: 0 })
  })

  it('10. default breaker opens after exactly 5 consecutive failures', async () => {
    const { dbCircuitBreaker } = require('@/lib/observability/db-circuit-breaker')
    dbCircuitBreaker.reset()
    const boom = async (): Promise<never> => {
      throw new Error('down')
    }
    for (let i = 1; i <= 4; i++) {
      await dbCircuitBreaker.execute(boom)
      expect(dbCircuitBreaker.getState().state).toBe('CLOSED')
    }
    await dbCircuitBreaker.execute(boom)
    expect(dbCircuitBreaker.getState()).toEqual({ state: 'OPEN', failureCount: 5 })
    dbCircuitBreaker.reset()
  })

  it('11. a HALF_OPEN failure re-opens (does not silently close)', async () => {
    const { DbCircuitBreaker } = require('@/lib/observability/db-circuit-breaker')
    const cb = new DbCircuitBreaker(1, 20)
    await cb.execute(async () => {
      throw new Error('down')
    })
    expect(cb.getState().state).toBe('OPEN')
    await new Promise((r) => setTimeout(r, 40))
    await cb.execute(async () => {
      throw new Error('still down')
    })
    expect(cb.getState().state).toBe('OPEN')
    expect(cb.getState().failureCount).toBe(2)
  })
})

describe('AUDIT retry & reconnection (12-13)', () => {
  it('12. withDatabaseRetry recovers after transient P2024s (alias path)', async () => {
    const p2024 = Object.assign(new Error('P2024 burst'), { code: 'P2024' })
    const fn = jest
      .fn()
      .mockRejectedValueOnce(p2024)
      .mockRejectedValueOnce(p2024)
      .mockResolvedValueOnce('recovered')
    const sleepFn = jest.fn().mockResolvedValue(undefined)
    await expect(withDatabaseRetry(fn, { sleepFn })).resolves.toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(mockReportError).toHaveBeenCalled()
  })

  it('13. connection health flag starts healthy (auto-reconnect guard skips mocked clients)', () => {
    expect(isConnectionHealthy()).toBe(true)
  })
})

describe('AUDIT performance surfaces (14-15)', () => {
  it('14. home-cache round-trips through the shared (fallback) store', async () => {
    const { getHomeCache, setHomeCache, clearHomeCache } = require('@/lib/home-cache')
    await clearHomeCache()
    expect(await getHomeCache()).toBeNull()
    await setHomeCache({ probe: 1 }, Date.now())
    const hit = await getHomeCache()
    expect(hit).not.toBeNull()
    expect((hit as { data: unknown }).data).toEqual({ probe: 1 })
    await clearHomeCache()
    expect(await getHomeCache()).toBeNull()
  })

  it('15. every sitemap findMany is bounded with take (no full-table scans)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/app/sitemap.ts'), 'utf-8')
    const blocks = [...src.matchAll(/findMany\(\{([\s\S]*?)\}\)/g)].map((m) => m[1])
    expect(blocks.length).toBeGreaterThanOrEqual(5)
    for (const b of blocks) {
      expect(b).toMatch(/take:\s*\d+/)
      expect(b).toMatch(/orderBy/)
    }
  })
})

describe('AUDIT integration (16)', () => {
  it('16. monitoring endpoint stays 200 with metrics:null when the DB probe fails', async () => {
    jest.resetModules()
    jest.doMock('@/lib/auth', () => ({
      AuthError: class extends Error {
        status = 200
      },
      requireAdmin: async () => ({ id: 'a', role: 'admin' }),
    }))
    jest.doMock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ success: true }) }))
    jest.doMock('@/lib/db', () => ({ db: {}, isConnectionHealthy: () => false }))
    jest.doMock('@/lib/observability/db-monitor', () => ({
      DbMonitor: {
        getMetrics: async () => null,
        checkHealth: async () => ({ healthy: false, issues: ['Unable to collect metrics'] }),
        getCachedOrCollect: async () => ({ metrics: null, stale: false }),
      },
    }))
    jest.doMock('@/lib/observability/db-circuit-breaker', () => ({
      dbCircuitBreaker: { getState: () => ({ state: 'OPEN', failureCount: 7 }) },
    }))
    const { GET } = require('@/app/api/admin/db/monitoring/route')
    const { NextRequest } = require('next/server')
    const res = await GET(new NextRequest('http://x/api/admin/db/monitoring'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('unknown')
    expect(body.data.metrics).toBeNull()
    expect(body.data.circuitBreaker).toEqual({ state: 'OPEN', failureCount: 7 })
    expect(body.data.connectionHealthy).toBe(false)
  })
})
