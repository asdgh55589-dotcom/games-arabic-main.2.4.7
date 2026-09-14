/**
 * SA-3 (Phase 2 Task C): requestId plumbing + empty-catch backfill.
 *
 * Covers:
 * 1. requestId generated + echoed (proxy helpers getOrCreateRequestId/withRequestId)
 * 2. redis-down path logs warn via structured logger (no swallow — fallback returned)
 * 3. intentional sites keep behavior (same return values as before the backfill)
 * 4. token masking first4…last2 with no full token in log output
 * 5. unexpected errors reach reportError with route/action ctx (control flow unchanged)
 */
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!'
process.env.UPSTASH_REDIS_REST_URL = ''
process.env.UPSTASH_REDIS_REST_TOKEN = ''

jest.mock('jose', () => ({
  SignJWT: jest.fn(),
  jwtVerify: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// Real maskId (pure fn), mocked reportError (assertable, no Sentry I/O).
jest.mock('@/lib/error-reporting', () => {
  const actual = jest.requireActual('@/lib/error-reporting') as typeof import('@/lib/error-reporting')
  return { ...actual, reportError: jest.fn(() => 'skipped') }
})

jest.mock('@/lib/auth', () => ({
  getUserIdFromRequestCookies: jest.fn().mockResolvedValue(null),
  requireAuth: jest.fn(),
  requireCreatorStudio: jest.fn(),
}))

jest.mock('@/lib/home-cache', () => ({
  clearHomeCache: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    session: {
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}))

import { NextResponse } from 'next/server'
import { getUserIdFromRequestCookies, requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { maskId, reportError } from '@/lib/error-reporting'
import { clearHomeCache } from '@/lib/home-cache'
import { logger } from '@/lib/logger'

// proxy.ts requires JWT_SECRET at import — set before the lazy require.
const { getOrCreateRequestId, withRequestId } = require('@/proxy') as typeof import('@/proxy')

const mockWarn = logger.warn as jest.Mock
const mockError = logger.error as jest.Mock
const mockReportError = reportError as jest.Mock
const mockRequireAuth = requireAuth as jest.Mock
const mockGetUserId = getUserIdFromRequestCookies as jest.MockedFunction<
  typeof getUserIdFromRequestCookies
>
const mockClearHomeCache = clearHomeCache as jest.Mock
const mockSession = db.session as unknown as Record<string, jest.Mock>

function headerReq(id: string | null): { headers: Headers } {
  const h = new Headers()
  if (id) h.set('x-request-id', id)
  return { headers: h }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUserId.mockResolvedValue(null)
  mockClearHomeCache.mockImplementation(() => {
    // intentional: default no-op, overridden per test that needs a throw
  })
  mockSession.findUnique.mockResolvedValue(null)
  mockSession.deleteMany.mockResolvedValue({ count: 1 })
  mockSession.findMany.mockResolvedValue([])
})

describe('requestId plumbing (proxy helpers)', () => {
  it('reuses the incoming x-request-id when present', () => {
    expect(getOrCreateRequestId(headerReq('upstream-123'))).toBe('upstream-123')
  })

  it('generates a UUID v4-shaped id when absent', () => {
    const id = getOrCreateRequestId(headerReq(null))
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('echoes the requestId on the response via withRequestId', () => {
    const res = withRequestId(NextResponse.json({ ok: true }), 'req-abc')
    expect(res.headers.get('x-request-id')).toBe('req-abc')
  })
})

describe('redis-down path logs warn (no swallow)', () => {
  const OLD_URL = process.env.UPSTASH_REDIS_REST_URL
  const OLD_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = OLD_URL
    process.env.UPSTASH_REDIS_REST_TOKEN = OLD_TOKEN
    jest.dontMock('@upstash/redis')
  })

  it('redis throw → logger.warn with event + memory fallback returned', async () => {
    let redisMod: typeof import('@/lib/redis')
    jest.isolateModules(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'
      jest.doMock('@upstash/redis', () => ({
        Redis: class {
          get = jest.fn().mockRejectedValue(new Error('redis down'))
          set = jest.fn().mockRejectedValue(new Error('redis down'))
          del = jest.fn().mockRejectedValue(new Error('redis down'))
        },
      }))
      redisMod = require('@/lib/redis') as typeof import('@/lib/redis')
    })
    const got = await redisMod!.redisGet('any-key')
    expect(got).toBeNull()
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'redis_get_failed' }),
      expect.any(String),
    )
    // setNX falls back to memory (no throw) after logging the failure
    await expect(redisMod!.redisSetNX('sa3-test-key', 60)).resolves.toBe(true)
  })
})

describe('intentional sites keep behavior', () => {
  it('clearHomeCache throw → recordModView still counts + warns (no swallow, no rethrow)', async () => {
    mockClearHomeCache.mockImplementation(() => {
      throw new Error('cache down')
    })
    const { recordModView } = require('@/lib/counters') as typeof import('@/lib/counters')
    const fakeDb = {
      mod: { update: jest.fn().mockResolvedValue({}) },
      modView: { create: jest.fn().mockResolvedValue({}) },
    }
    const req = new Request('http://localhost/m/test', {
      headers: { 'x-forwarded-for': '9.9.9.9', 'user-agent': 'Mozilla/5.0 Chrome/120' },
    })
    await expect(recordModView('sa3-mod-intentional', req, fakeDb)).resolves.toEqual({
      counted: true,
    })
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'home_cache_clear_failed', action: 'record_mod_view' }),
      expect.any(String),
    )
  })

  it('db down → session-ledger fail-open shapes unchanged (false / void / [])', async () => {
    mockSession.findUnique.mockRejectedValue(new Error('db down'))
    mockSession.deleteMany.mockRejectedValue(new Error('db down'))
    mockSession.findMany.mockRejectedValue(new Error('db down'))
    const ledger = require('@/lib/session-ledger') as typeof import('@/lib/session-ledger')
    await expect(ledger.isSessionActive('tok')).resolves.toBe(false)
    await expect(ledger.revokeSession('tok')).resolves.toBeUndefined()
    await expect(ledger.listUserSessions('u1')).resolves.toEqual([])
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'session_list_failed' }),
      expect.any(String),
    )
  })
})

describe('token masking (first4…last2)', () => {
  it("maskId('abcd1234ef') → 'abcd…ef'", () => {
    expect(maskId('abcd1234ef')).toBe('abcd…ef')
  })

  it('revokeSession logs only the masked token, never the full bearer', async () => {
    const ledger = require('@/lib/session-ledger') as typeof import('@/lib/session-ledger')
    await ledger.revokeSession('abcd1234ef')
    expect(mockWarn).toHaveBeenCalledWith({ token: 'abcd…ef' }, 'session revoked')
    const blob = JSON.stringify(mockWarn.mock.calls) + JSON.stringify(mockError.mock.calls)
    expect(blob).not.toContain('abcd1234ef')
  })
})

describe('unexpected errors reach reportError (control flow unchanged)', () => {
  function patchReq(body: unknown): { req: Request; params: { params: Promise<{ id: string }> } } {
    return {
      req: new Request('http://localhost/api/mod-requests/r1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }) as unknown as Request,
      params: { params: Promise.resolve({ id: 'r1' }) },
    }
  }

  it('non-auth PATCH failure → 500 + logger.error + reportError(route, action)', async () => {
    mockRequireAuth.mockRejectedValue(new Error('db down'))
    const { PATCH } = require('@/app/api/mod-requests/[id]/route') as typeof import(
      '@/app/api/mod-requests/[id]/route'
    )
    const { req, params } = patchReq({ action: 'boost' })
    const res = await PATCH(req as never, params)
    expect(res.status).toBe(500)
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'mod_request_patch_failed' }),
      expect.any(String),
    )
    expect(mockReportError).toHaveBeenCalledWith(expect.any(Error), {
      route: 'api/mod-requests/[id]',
      action: 'PATCH_boost',
    })
  })

  it('401 passthrough preserved → 401 + reportError NOT called', async () => {
    mockRequireAuth.mockRejectedValue({ status: 401 })
    const { PATCH } = require('@/app/api/mod-requests/[id]/route') as typeof import(
      '@/app/api/mod-requests/[id]/route'
    )
    const { req, params } = patchReq({ action: 'boost' })
    const res = await PATCH(req as never, params)
    expect(res.status).toBe(401)
    expect(mockReportError).not.toHaveBeenCalled()
  })
})
