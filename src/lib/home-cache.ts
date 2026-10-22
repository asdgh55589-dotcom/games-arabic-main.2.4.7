/**
 * lib/home-cache.ts — homepage payload cache (Redis-shared, 300s TTL).
 *
 * Previously process-local (60s): every instance/stale restart refetched the
 * ~27-query homepage fan-out and stampeded the pool. Now backed by
 * Upstash Redis (with the usual in-memory fallback inside `lib/redis.ts`),
 * so all instances share one payload. Writers (counters, endorse, sections
 * admin) invalidate eagerly via `clearHomeCache()` — staleness is bounded
 * by invalidation, not by TTL.
 *
 * ---- Generation guard (race fix) ----
 * The classic invalidate/repopulate race: a reader that started building the
 * payload BEFORE a writer committed its DB change can write that stale
 * payload AFTER the writer's `clearHomeCache()` already ran — the homepage
 * then serves stale data for the whole TTL.
 *
 * Fix: a monotonically increasing `generation` counter lives in Redis next
 * to the payload.
 *   - `clearHomeCache()` BUMPS the generation first, then deletes the payload.
 *   - `setHomeCache()` stamps the payload with the generation it was built
 *     against (captured BEFORE the DB reads — see `getHomeCacheGeneration`).
 *   - `getHomeCache()` returns a cache miss when the stamped generation does
 *     not match the current one.
 * Consequence: a payload built against generation N is never served once the
 * generation moved past N — regardless of whether it was written before or
 * after the invalidation.
 */
import { redisDel, redisGet, redisIncr, redisSet } from './redis'

const HOME_CACHE_KEY = 'home:page:v1'
/** Generation counter key — monotonically increasing, shared across instances. */
const HOME_CACHE_GEN_KEY = 'home:page:v1:gen'

/** 300s — public homepage data changes slowly; invalidation is eager. */
export const HOME_CACHE_TTL_S = 300
const CACHE_TTL_MS = HOME_CACHE_TTL_S * 1000

/**
 * TTL of the generation counter. Must be LONGER than the payload TTL so a
 * live generation is never "lost" while a payload is still cached (a lost
 * generation only causes a cache miss + rebuild, never a stale hit).
 */
export const HOME_CACHE_GEN_TTL_S = 86_400

interface HomeCachePayload {
  data: unknown
  timestamp: number
  /** Generation this payload was built against (see module docs). */
  generation: number
}

/**
 * Current generation of the homepage cache.
 * Callers that build a payload MUST capture this BEFORE reading the DB and
 * pass it to `setHomeCache()` — otherwise a payload built before an
 * invalidation would be stamped with the post-invalidation generation and
 * could still be served stale.
 */
export async function getHomeCacheGeneration(): Promise<number> {
  const raw = await redisGet<number | string>(HOME_CACHE_GEN_KEY)
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : 0
}

export async function getHomeCache(): Promise<{ data: unknown; timestamp: number } | null> {
  const generation = await getHomeCacheGeneration()
  const payload = await redisGet<HomeCachePayload>(HOME_CACHE_KEY)
  if (!payload) return null
  // Generation mismatch → the payload predates an invalidation → treat as a miss.
  if (payload.generation !== generation) return null
  return { data: payload.data, timestamp: payload.timestamp }
}

/**
 * Store the homepage payload.
 * `generation` MUST be the value captured BEFORE the payload was built
 * (see `getHomeCacheGeneration`); when omitted it falls back to the current
 * generation, which keeps older callers working but leaves the
 * invalidate/repopulate race open for them.
 */
export async function setHomeCache(
  data: unknown,
  timestamp: number,
  generation?: number,
): Promise<void> {
  const gen = typeof generation === 'number' ? generation : await getHomeCacheGeneration()
  const payload: HomeCachePayload = { data, timestamp, generation: gen }
  await redisSet(HOME_CACHE_KEY, payload, HOME_CACHE_TTL_S)
}

export async function clearHomeCache(): Promise<void> {
  // Bump FIRST: any payload built against the old generation becomes invalid
  // immediately — even a writer that was mid-build and lands after this call.
  await redisIncr(HOME_CACHE_GEN_KEY, HOME_CACHE_GEN_TTL_S)
  await redisDel(HOME_CACHE_KEY)
}

export function getHomeCacheTtl(): number {
  return CACHE_TTL_MS
}
