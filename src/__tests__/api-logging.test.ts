/**
 * Phase 2 — Logging & observability contract tests.
 * - createRequestLogger/logError shape (requestId, route, file/line/function)
 * - withRequestLogger lifecycle (x-request-id echo, RED metrics, error path)
 */
import { NextResponse } from 'next/server'
import { createRequestLogger, logError, logger } from '@/lib/logger'
import { getRouteMetrics, resetMetrics } from '@/lib/observability/red-metrics'
import { withRequestLogger } from '@/lib/request-logger'

describe('createRequestLogger', () => {
  it('returns info/warn/error/debug functions', () => {
    const log = createRequestLogger('req-1', 'GET /api/x')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
    expect(typeof log.debug).toBe('function')
  })
})

describe('logError', () => {
  it('emits message + file/line/function with request context', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    try {
      const err = new Error('boom')
      logError(err, { requestId: 'req-9', route: 'GET /api/x', userId: 'u-1' })
      expect(spy).toHaveBeenCalledTimes(1)
      const [meta, msg] = spy.mock.calls[0] as unknown as [Record<string, unknown>, string]
      expect(msg).toBe('boom')
      expect(meta.requestId).toBe('req-9')
      expect(meta.route).toBe('GET /api/x')
      expect(meta.userId).toBe('u-1')
      const errMeta = meta.err as Record<string, unknown>
      expect(errMeta.message).toBe('boom')
      expect(typeof errMeta.file).toBe('string')
      expect(typeof errMeta.line).toBe('string')
      expect(typeof errMeta.function).toBe('string')
    } finally {
      spy.mockRestore()
    }
  })

  it('wraps non-Error values without throwing', () => {
    const spy = jest.spyOn(logger, 'error').mockImplementation(() => {})
    try {
      expect(() => logError('plain string failure', { route: 'GET /api/x' })).not.toThrow()
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })
})

function req(path = 'http://x/api/widgets'): import('next/server').NextRequest {
  return new (require('next/server').NextRequest)(path, { method: 'GET' }) as never
}

describe('withRequestLogger', () => {
  beforeEach(() => resetMetrics())

  it('echoes x-request-id and records RED success', async () => {
    const handler = withRequestLogger(async () => NextResponse.json({ ok: true }), 'GET /api/widgets')
    const res = await handler(req(), undefined)
    expect(res.status).toBe(200)
    const rid = res.headers.get('x-request-id')
    expect(typeof rid).toBe('string')
    expect(rid!.length).toBeGreaterThan(0)
    const m = getRouteMetrics('GET /api/widgets')
    expect(m.rate).toBe(1)
    expect(m.errors).toBe(0)
  })

  it('propagates incoming x-request-id', async () => {
    const handler = withRequestLogger(async () => NextResponse.json({ ok: true }), 'GET /api/widgets')
    const r = req()
    r.headers.set('x-request-id', 'incoming-123')
    const res = await handler(r, undefined)
    expect(res.headers.get('x-request-id')).toBe('incoming-123')
  })

  it('records RED error and rethrows on handler failure', async () => {
    const handler = withRequestLogger(async () => {
      throw new Error('handler blew up')
    }, 'GET /api/widgets')
    await expect(handler(req(), undefined)).rejects.toThrow('handler blew up')
    const m = getRouteMetrics('GET /api/widgets')
    expect(m.rate).toBe(1)
    expect(m.errors).toBe(1)
  })
})
