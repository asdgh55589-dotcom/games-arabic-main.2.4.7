jest.mock('@opentelemetry/exporter-logs-otlp-http', () => ({
  OTLPLogExporter: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: jest.fn().mockImplementation(() => ({})),
}))

jest.mock('@opentelemetry/sdk-logs', () => {
  const mockShutdown = jest.fn().mockResolvedValue(undefined)
  return {
    LoggerProvider: jest.fn().mockImplementation(() => ({
      addLogRecordProcessor: jest.fn(),
      shutdown: mockShutdown,
    })),
    SimpleLogRecordProcessor: jest.fn().mockImplementation(() => ({})),
  }
})

jest.mock('@opentelemetry/sdk-metrics', () => {
  const mockShutdown = jest.fn().mockResolvedValue(undefined)
  return {
    MeterProvider: jest.fn().mockImplementation(() => ({
      shutdown: mockShutdown,
    })),
    PeriodicExportingMetricReader: jest.fn().mockImplementation(() => ({})),
  }
})

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import {
  recordRequest,
  getRouteMetrics,
  getAllMetrics,
  resetMetrics,
  routeStore,
} from '@/lib/observability/red-metrics'
import { trackRoute } from '@/lib/observability/middleware'

const SAVED_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
const SAVED_HEADERS = process.env.OTEL_EXPORTER_OTLP_HEADERS

beforeEach(() => {
  jest.clearAllMocks()
  resetMetrics()
  delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  delete process.env.OTEL_EXPORTER_OTLP_HEADERS
})

afterAll(() => {
  if (SAVED_ENDPOINT !== undefined) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = SAVED_ENDPOINT
  if (SAVED_HEADERS !== undefined) process.env.OTEL_EXPORTER_OTLP_HEADERS = SAVED_HEADERS
})

// ─── OTLP init ───────────────────────────────────────────────────────

describe('initOtlp', () => {
  it('no-ops when OTEL_EXPORTER_OTLP_ENDPOINT is missing', async () => {
    const { initOtlp } = await import('@/lib/observability/otlp')
    initOtlp()
    expect(OTLPLogExporter).not.toHaveBeenCalled()
    expect(OTLPMetricExporter).not.toHaveBeenCalled()
  })

  it('creates exporters when endpoint is set', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Basic dXNlcjpwYXNz'
    const { initOtlp } = await import('@/lib/observability/otlp')
    initOtlp()
    expect(OTLPLogExporter).toHaveBeenCalledTimes(1)
    expect(OTLPMetricExporter).toHaveBeenCalledTimes(1)
    const logArgs = (OTLPLogExporter as jest.Mock).mock.calls[0][0]
    expect(logArgs.url).toBe('http://localhost:4318')
    expect(logArgs.headers).toEqual({ Authorization: 'Basic dXNlcjpwYXNz' })
  })

  it('parses multiple comma-separated headers', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'X-Custom=a,X-Other=b'
    const { initOtlp } = await import('@/lib/observability/otlp')
    initOtlp()
    const logArgs = (OTLPLogExporter as jest.Mock).mock.calls[0][0]
    expect(logArgs.headers).toEqual({ 'X-Custom': 'a', 'X-Other': 'b' })
  })
})

// ─── RED metrics ─────────────────────────────────────────────────────

describe('recordRequest', () => {
  it('adds entry to store', () => {
    recordRequest('/api/auth/login', 120, false)
    const entry = routeStore.get('/api/auth/login')
    expect(entry).toBeDefined()
    expect(entry!.timestamps).toHaveLength(1)
    expect(entry!.durations).toEqual([120])
    expect(entry!.errors).toEqual([0])
  })

  it('increments entries for same route', () => {
    recordRequest('/api/mods', 50, false)
    recordRequest('/api/mods', 80, true)
    const entry = routeStore.get('/api/mods')
    expect(entry!.timestamps).toHaveLength(2)
    expect(entry!.errors).toEqual([0, 1])
  })
})

describe('getRouteMetrics', () => {
  it('returns zeros for unknown route', () => {
    const m = getRouteMetrics('/api/unknown')
    expect(m).toEqual({ rate: 0, errors: 0, duration: { p50: 0, p95: 0, p99: 0 } })
  })

  it('calculates correct p50/p95/p99 from known array', () => {
    const durations = [10, 20, 30, 40, 50]
    durations.forEach((d) => recordRequest('/api/test', d, false))
    const m = getRouteMetrics('/api/test')
    expect(m.rate).toBe(5)
    expect(m.errors).toBe(0)
    expect(m.duration.p50).toBe(30)
    expect(m.duration.p95).toBe(50)
    expect(m.duration.p99).toBe(50)
  })

  it('counts errors correctly', () => {
    recordRequest('/api/comments', 10, false)
    recordRequest('/api/comments', 20, true)
    recordRequest('/api/comments', 30, true)
    const m = getRouteMetrics('/api/comments')
    expect(m.rate).toBe(3)
    expect(m.errors).toBe(2)
  })

  it('RED counters increment correctly', () => {
    for (let i = 0; i < 10; i++) {
      recordRequest('/api/admin/users', i * 10, i % 3 === 0)
    }
    const m = getRouteMetrics('/api/admin/users')
    expect(m.rate).toBe(10)
    expect(m.errors).toBe(4) // indices 0,3,6,9
  })
})

describe('sliding window pruning', () => {
  it('prunes entries older than 60s', () => {
    const now = 1_000_000
    jest.spyOn(Date, 'now').mockReturnValue(now)
    recordRequest('/api/old', 10, false)

    jest.spyOn(Date, 'now').mockReturnValue(now + 61_000)
    recordRequest('/api/old', 20, false)

    const m = getRouteMetrics('/api/old')
    expect(m.rate).toBe(1)
    expect(m.duration.p50).toBe(20)
    ;(Date.now as jest.Mock).mockRestore()
  })
})

describe('resetMetrics', () => {
  it('clears store', () => {
    recordRequest('/api/auth/x', 10, false)
    recordRequest('/api/mods/y', 20, true)
    expect(routeStore.size).toBe(2)
    resetMetrics()
    expect(routeStore.size).toBe(0)
  })
})

// ─── PII check ───────────────────────────────────────────────────────

describe('PII check', () => {
  it('no userId, email, or password in OTLP payloads', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318'
    process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Basic dXNlcjpwYXNz'
    const { initOtlp } = require('@/lib/observability/otlp')
    initOtlp()
    const allConstructorArgs = (OTLPLogExporter as jest.Mock).mock.calls
      .concat((OTLPMetricExporter as jest.Mock).mock.calls)
    const payload = JSON.stringify(allConstructorArgs)
    expect(payload).not.toMatch(/userId|email|password/i)
  })
})

// ─── Middleware ───────────────────────────────────────────────────────

describe('trackRoute', () => {
  it('returns a callback that records metrics', () => {
    const cb = trackRoute('/api/comments/create')
    cb(150, false)
    cb(200, true)
    const m = getRouteMetrics('/api/comments/create')
    expect(m.rate).toBe(2)
    expect(m.errors).toBe(1)
  })
})

// ─── getAllMetrics ────────────────────────────────────────────────────

describe('getAllMetrics', () => {
  it('returns metrics for all tracked routes', () => {
    recordRequest('/api/auth/login', 100, false)
    recordRequest('/api/mods', 200, true)
    const all = getAllMetrics()
    expect(all.size).toBe(2)
    expect(all.get('/api/auth/login')!.rate).toBe(1)
    expect(all.get('/api/mods')!.errors).toBe(1)
  })
})
