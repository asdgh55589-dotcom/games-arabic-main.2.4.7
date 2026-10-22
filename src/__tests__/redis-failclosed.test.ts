/**
 * R21 — Redis-down fail-closed for the live counters.
 *
 * Contract (C-REDIS):
 *   redisSetNX(key, ttlSeconds, opts?: { failClosed?: boolean }): Promise<boolean>
 *   - Redis healthy          → unchanged (SET NX: true on first write)
 *   - Redis unavailable      → failClosed: true  → false (NOT counted, no memory fallback)
 *                              failClosed: false → in-memory fallback (today's behaviour)
 *
 * The DEFAULT must stay fail-open: src/lib/idempotency.ts calls redisSetNX
 * as a best-effort "claim" and DISCARDS the boolean — switching the default
 * to fail-closed would silently disable the in-memory idempotency lock.
 */
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

const OLD_URL = process.env.UPSTASH_REDIS_REST_URL
const OLD_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

interface LoadedRedis {
  redis: typeof import('@/lib/redis')
  /** The `logger.warn` jest.fn() of THIS isolated module registry. */
  warn: jest.Mock
}

/**
 * Load a FRESH copy of @/lib/redis with a given @upstash/redis mock.
 *
 * The logger is pulled from the SAME isolated registry on purpose: jest 30's
 * `jest.resetModules()` clears the module-mock registry, so the `@/lib/logger`
 * factory re-runs and hands out BRAND NEW jest.fn()s. A top-level import of
 * the logger would then reference a stale mock and never observe any call.
 */
function loadRedis(redisMock: unknown, configured: boolean): LoadedRedis {
  process.env.UPSTASH_REDIS_REST_URL = configured ? 'https://fake.upstash.io' : ''
  process.env.UPSTASH_REDIS_REST_TOKEN = configured ? 'fake-token' : ''
  let mod: typeof import('@/lib/redis')
  let loggerMod: typeof import('@/lib/logger')
  jest.isolateModules(() => {
    jest.doMock('@upstash/redis', () => redisMock)
    mod = require('@/lib/redis') as typeof import('@/lib/redis')
    loggerMod = require('@/lib/logger') as typeof import('@/lib/logger')
  })
  return { redis: mod!, warn: loggerMod!.logger.warn as jest.Mock }
}

/** Upstash mock whose SET always succeeds (no NX emulation needed for fail paths). */
function healthyRedis() {
  const keys = new Set<string>()
  return {
    Redis: class {
      async set(key: string, _value: string, opts?: { nx?: boolean }) {
        if (opts?.nx) {
          if (keys.has(key)) return null
          keys.add(key)
        }
        return 'OK'
      }
      async get() {
        return null
      }
      async del() {
        return 1
      }
    },
  }
}

/** Upstash mock whose SET always rejects (Redis configured but unreachable). */
function brokenRedis() {
  return {
    Redis: class {
      async set() {
        throw new Error('redis down')
      }
      async get() {
        throw new Error('redis down')
      }
      async del() {
        throw new Error('redis down')
      }
    },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.resetModules()
})

afterEach(() => {
  process.env.UPSTASH_REDIS_REST_URL = OLD_URL
  process.env.UPSTASH_REDIS_REST_TOKEN = OLD_TOKEN
  jest.dontMock('@upstash/redis')
})

describe('redisSetNX — fail-closed (Redis unavailable)', () => {
  it('returns false and does NOT write to the in-memory store', async () => {
    const { redis } = loadRedis(brokenRedis(), true)
    const key = 'r21-failclosed-broken-redis'

    await expect(redis.redisSetNX(key, 60, { failClosed: true })).resolves.toBe(false)

    // The in-memory store must NOT have been used: a follow-up fail-OPEN call
    // (same key) still sees a FRESH key → true.
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
  })

  it('returns false when Redis is not configured at all', async () => {
    const { redis } = loadRedis(healthyRedis(), false)
    const key = 'r21-failclosed-not-configured'

    await expect(redis.redisSetNX(key, 60, { failClosed: true })).resolves.toBe(false)
    // No memory fallback → the key is still fresh for a fail-open call.
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
  })

  it('logs a warning via logger.warn', async () => {
    const { redis, warn } = loadRedis(brokenRedis(), true)
    await redis.redisSetNX('r21-failclosed-warn', 60, { failClosed: true })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'redis_setnx_failclosed' }),
      expect.any(String),
    )
  })

  it('the fail-closed warning carries the event, the action and the error', async () => {
    const { redis, warn } = loadRedis(brokenRedis(), true)
    await redis.redisSetNX('r21-failclosed-fields', 60, { failClosed: true })
    const call = warn.mock.calls.find((c) => c[0]?.event === 'redis_setnx_failclosed')
    expect(call).toBeDefined()
    expect(call?.[0]).toEqual(
      expect.objectContaining({
        event: 'redis_setnx_failclosed',
        action: 'setnx',
        err: expect.anything(),
      }),
    )
  })
})

describe('redisSetNX — default stays fail-open (idempotency.ts contract)', () => {
  it('falls back to the in-memory store when Redis is unavailable', async () => {
    const { redis } = loadRedis(brokenRedis(), true)
    const key = 'r21-failopen-broken-redis'

    // First call claims the key (in-memory), second call is a duplicate.
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(false)
  })

  it('falls back to the in-memory store when Redis is not configured', async () => {
    const { redis } = loadRedis(healthyRedis(), false)
    const key = 'r21-failopen-not-configured'

    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(false)
  })

  it('a fail-closed claim does not block a later fail-open claim of the same key', async () => {
    const { redis } = loadRedis(brokenRedis(), true)
    const key = 'r21-mixed-mode'

    await expect(redis.redisSetNX(key, 60, { failClosed: true })).resolves.toBe(false)
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(false)
  })

  it('the default (no opts) never emits the fail-closed event', async () => {
    const { redis, warn } = loadRedis(brokenRedis(), true)
    await redis.redisSetNX('r21-failopen-no-event', 60)
    const calls = warn.mock.calls.filter((c) => c[0]?.event === 'redis_setnx_failclosed')
    expect(calls).toHaveLength(0)
  })
})

describe('redisSetNX — Redis healthy (dedup still works)', () => {
  it('returns true on the first call and false on the second', async () => {
    const { redis } = loadRedis(healthyRedis(), true)
    const key = 'r21-healthy-dedup'

    await expect(redis.redisSetNX(key, 60)).resolves.toBe(true)
    await expect(redis.redisSetNX(key, 60)).resolves.toBe(false)
  })

  it('failClosed does not change the healthy behaviour', async () => {
    const { redis } = loadRedis(healthyRedis(), true)
    const key = 'r21-healthy-failclosed'

    await expect(redis.redisSetNX(key, 60, { failClosed: true })).resolves.toBe(true)
    await expect(redis.redisSetNX(key, 60, { failClosed: true })).resolves.toBe(false)
  })

  it('a healthy fail-closed claim does not emit the fail-closed warning', async () => {
    const { redis, warn } = loadRedis(healthyRedis(), true)
    await redis.redisSetNX('r21-healthy-no-warn', 60, { failClosed: true })
    const calls = warn.mock.calls.filter((c) => c[0]?.event === 'redis_setnx_failclosed')
    expect(calls).toHaveLength(0)
  })
})
