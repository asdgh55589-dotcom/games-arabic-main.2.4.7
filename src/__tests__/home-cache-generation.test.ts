/**
 * S4 — homepage cache generation guard.
 *
 * The classic invalidate/repopulate race: a reader that started building the
 * payload BEFORE a writer committed its DB change can write that stale payload
 * AFTER `clearHomeCache()` already ran — the homepage then serves stale data
 * for the whole TTL.
 *
 * The guard: a monotonically increasing `generation` counter lives next to the
 * payload.
 *   - `clearHomeCache()` BUMPS the generation, then deletes the payload.
 *   - `setHomeCache(data, ts, generation)` stamps the payload with the
 *     generation it was built against.
 *   - `getHomeCache()` returns a MISS when the stamped generation no longer
 *     matches the current one.
 *
 * These tests use a mocked `@/lib/redis` (in-memory Map) so the race can be
 * replayed deterministically.
 */

jest.mock('@/lib/redis', () => {
  const store = new Map<string, unknown>()
  return {
    __store: store,
    redisGet: jest.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    redisSet: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    redisDel: jest.fn(async (key: string) => {
      store.delete(key)
    }),
    redisIncr: jest.fn(async (key: string) => {
      const next = Number(store.get(key) ?? 0) + 1
      store.set(key, next)
      return next
    }),
  }
})

import {
  clearHomeCache,
  getHomeCache,
  getHomeCacheGeneration,
  getHomeCacheTtl,
  HOME_CACHE_GEN_TTL_S,
  HOME_CACHE_TTL_S,
  setHomeCache,
} from '@/lib/home-cache'

const redisMock = jest.requireMock('@/lib/redis') as {
  __store: Map<string, unknown>
  redisGet: jest.Mock
  redisSet: jest.Mock
  redisDel: jest.Mock
  redisIncr: jest.Mock
}

const PAYLOAD_KEY = 'home:page:v1'
const GEN_KEY = 'home:page:v1:gen'

beforeEach(() => {
  redisMock.__store.clear()
  jest.clearAllMocks()
})

describe('home cache — generation guard', () => {
  it('a payload written BEFORE clearHomeCache() is NOT returned afterwards', async () => {
    await setHomeCache({ probe: 'before' }, Date.now())
    // sanity: it IS cached before the invalidation
    expect(await getHomeCache()).not.toBeNull()

    await clearHomeCache()

    expect(await getHomeCache()).toBeNull()
  })

  it('a payload built against the OLD generation is never served (the race)', async () => {
    // The reader captures the generation BEFORE its DB reads …
    const staleGeneration = await getHomeCacheGeneration()

    // … a writer invalidates (bumps the generation + drops the payload) …
    await clearHomeCache()

    // … and the in-flight reader lands its stale payload afterwards.
    await setHomeCache({ probe: 'stale' }, Date.now(), staleGeneration)

    // The generation mismatch must turn this into a MISS.
    expect(await getHomeCache()).toBeNull()
  })

  it('a payload written AFTER the clear IS returned', async () => {
    await clearHomeCache()
    const generation = await getHomeCacheGeneration()
    await setHomeCache({ probe: 'after' }, Date.now(), generation)

    const hit = await getHomeCache()
    expect(hit).not.toBeNull()
    expect(hit?.data).toEqual({ probe: 'after' })
  })

  it('clearHomeCache() bumps the generation AND deletes the payload', async () => {
    const before = await getHomeCacheGeneration()
    await setHomeCache({ probe: 'x' }, Date.now())

    await clearHomeCache()

    const after = await getHomeCacheGeneration()
    expect(after).toBeGreaterThan(before)
    expect(redisMock.redisIncr).toHaveBeenCalledWith(GEN_KEY, expect.any(Number))
    expect(redisMock.redisDel).toHaveBeenCalledWith(PAYLOAD_KEY)
  })

  it('setHomeCache() without an explicit generation still round-trips', async () => {
    await setHomeCache({ probe: 'legacy' }, Date.now())
    const hit = await getHomeCache()
    expect(hit?.data).toEqual({ probe: 'legacy' })
  })

  it('the exported TTL contract is unchanged', () => {
    expect(HOME_CACHE_TTL_S).toBe(300)
    expect(getHomeCacheTtl()).toBe(HOME_CACHE_TTL_S * 1000)
  })

  it('the generation counter TTL is longer than the payload TTL', () => {
    expect(HOME_CACHE_GEN_TTL_S).toBeGreaterThan(HOME_CACHE_TTL_S)
  })
})
