/**
 * lib/home-cache.ts — homepage payload cache (Redis-shared, 300s TTL).
 *
 * Previously process-local (60s): every instance/stale restart refetched the
 * ~27-query homepage fan-out and stampeded the pool. Now backed by
 * Upstash Redis (with the usual in-memory fallback inside `lib/redis.ts`),
 * so all instances share one payload. Writers (counters, endorse, sections
 * admin) invalidate eagerly via `clearHomeCache()` — staleness is bounded
 * by invalidation, not by TTL.
 */
import { redisDel, redisGet, redisSet } from './redis'

const HOME_CACHE_KEY = 'home:page:v1'

/** 300s — public homepage data changes slowly; invalidation is eager. */
export const HOME_CACHE_TTL_S = 300
const CACHE_TTL_MS = HOME_CACHE_TTL_S * 1000

export async function getHomeCache(): Promise<{ data: unknown; timestamp: number } | null> {
  return redisGet<{ data: unknown; timestamp: number }>(HOME_CACHE_KEY)
}

export async function setHomeCache(data: unknown, timestamp: number): Promise<void> {
  await redisSet(HOME_CACHE_KEY, { data, timestamp }, HOME_CACHE_TTL_S)
}

export async function clearHomeCache(): Promise<void> {
  await redisDel(HOME_CACHE_KEY)
}

export function getHomeCacheTtl(): number {
  return CACHE_TTL_MS
}
