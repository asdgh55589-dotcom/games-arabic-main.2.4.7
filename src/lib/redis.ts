/**
 * lib/redis.ts — اتصال Redis عبر Upstash (serverless, HTTP-based).
 *
 * Single source of truth for:
 * - Redis configuration / HTTPS enforcement
 * - namespaced keys (`ga:`)
 * - TTL normalization (always >= 1 second)
 * - atomic INCR + EXPIRE via Lua
 * - bounded in-memory fallback
 * - fail-open helpers plus a strict result helper for security paths
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'
import { recordRedisFailure, recordRedisSuccess } from '@/lib/redis-circuit-breaker'

const KEY_PREFIX = 'ga:'

/** All application keys share one namespace. */
export function redisKey(key: string): string {
  return key.startsWith(KEY_PREFIX) ? key : `${KEY_PREFIX}${key}`
}

function resolveRedisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || '').trim()
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || '').trim()
  if (!url || !token) return null
  if (!url.startsWith('https://')) {
    logger.warn(
      { event: 'redis_insecure_url' },
      'redis REST URL must use https — Redis disabled, using in-memory fallback',
    )
    return null
  }
  return { url, token }
}

const redisConfig = resolveRedisConfig()
const hasRedis = redisConfig !== null

export function isRedisConfigured(): boolean {
  return hasRedis
}

let redisClient: Redis | null = null
if (redisConfig) {
  redisClient = new Redis(redisConfig)
}

/**
 * Every write must carry a positive integer TTL.
 * `0.5` used to become 0 (invalid EX / immediate expiry); now it becomes 1.
 */
export function normalizeTtl(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return 60
  return Math.max(1, Math.ceil(ttlSeconds))
}

/** SHA-256 identifier for Redis keys that would otherwise contain IPs/tokens. */
export async function hashRedisIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

// استخدام globalThis لضمان مشاركة الذاكرة بين جميع الـ routes وتجاوز HMR/Turbopack isolation
const _global = globalThis as unknown as {
  __memoryStore?: Map<string, { value: string; expires: number }>
}
const memoryStore: Map<string, { value: string; expires: number }> =
  _global.__memoryStore ??
  (_global.__memoryStore = new Map<string, { value: string; expires: number }>())

const MEMORY_SOFT_LIMIT = 5000
const MEMORY_HARD_LIMIT = 8000

/** Bound the fallback map: drop expired entries, then oldest entries. */
function evictMemoryStore(now = Date.now()): void {
  if (memoryStore.size <= MEMORY_SOFT_LIMIT) return
  for (const [key, entry] of memoryStore) {
    if (entry.expires < now) memoryStore.delete(key)
    if (memoryStore.size <= MEMORY_SOFT_LIMIT) return
  }
  const overflow = memoryStore.size - MEMORY_SOFT_LIMIT
  let removed = 0
  for (const key of memoryStore.keys()) {
    memoryStore.delete(key)
    if (++removed >= overflow) break
  }
  if (memoryStore.size > MEMORY_HARD_LIMIT) memoryStore.clear()
}

function readMemory<T>(key: string): T | null {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    memoryStore.delete(key)
    return null
  }
  try {
    return JSON.parse(entry.value) as T
  } catch (err) {
    logger.warn({ event: 'redis_memory_parse_failed', err }, 'redis memory entry unparseable')
    return null
  }
}

function writeMemory(key: string, stringValue: string, ttlSeconds: number): void {
  memoryStore.set(key, { value: stringValue, expires: Date.now() + ttlSeconds * 1000 })
  evictMemoryStore()
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const namespaced = redisKey(key)
  if (redisClient) {
    try {
      const result = await redisClient.get<T>(namespaced)
      recordRedisSuccess()
      return result
    } catch (err) {
      recordRedisFailure()
      logger.warn({ event: 'redis_get_failed', err }, 'redis get failed, using memory fallback')
    }
  }
  return readMemory<T>(namespaced)
}

/**
 * Strict read for security decisions: distinguishes a real miss from an
 * unavailable cache. `ok=false` means the caller must fail closed.
 */
export async function redisGetSafe<T>(key: string): Promise<{ ok: boolean; value: T | null }> {
  const namespaced = redisKey(key)
  if (redisClient) {
    try {
      const value = await redisClient.get<T>(namespaced)
      recordRedisSuccess()
      return { ok: true, value }
    } catch (err) {
      recordRedisFailure()
      logger.warn({ event: 'redis_get_safe_failed', err }, 'redis get failed (strict)')
      return { ok: false, value: null }
    }
  }
  // Memory is per-isolate. In production it cannot prove a shared cache miss.
  const value = readMemory<T>(namespaced)
  return { ok: process.env.NODE_ENV !== 'production', value }
}

/**
 * Best-effort write. Returns true only when the value is actually shared
 * (Redis write succeeded) or when running without Redis outside production.
 */
export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 60,
): Promise<boolean> {
  const ttl = normalizeTtl(ttlSeconds)
  const stringValue = JSON.stringify(value)
  const namespaced = redisKey(key)
  if (redisClient) {
    try {
      await redisClient.set(namespaced, stringValue, { ex: ttl })
      recordRedisSuccess()
      return true
    } catch (err) {
      recordRedisFailure()
      logger.warn({ event: 'redis_set_failed', err }, 'redis set failed, using memory fallback')
      writeMemory(namespaced, stringValue, ttl)
      return false
    }
  }
  writeMemory(namespaced, stringValue, ttl)
  return process.env.NODE_ENV !== 'production'
}

export async function redisDel(key: string): Promise<boolean> {
  const namespaced = redisKey(key)
  let shared = true
  if (redisClient) {
    try {
      await redisClient.del(namespaced)
      recordRedisSuccess()
    } catch (err) {
      recordRedisFailure()
      logger.warn({ event: 'redis_del_failed', err }, 'redis del failed, using memory fallback')
      shared = false
    }
  } else {
    shared = process.env.NODE_ENV !== 'production'
  }
  memoryStore.delete(namespaced)
  return shared
}

/**
 * SET NX — ينجح مرة واحدة فقط لكل مفتاح (للـ dedup).
 * يرجع true إذا كان المفتاح جديداً (أول مرة)، false إذا كان موجوداً.
 * مع fallback سلس إلى الذاكرة عند عدم توفر Redis — يعمل مع أو بدون Upstash
 * مع retry 3 مرات عند استخدام Upstash.
 *
 * ---- failClosed (R21) ----
 * `opts.failClosed === true` يغيّر سلوك تعطُّل Redis جذرياً:
 *   - Redis يعمل     → نفس السلوك تماماً (SET NX: true مرة واحدة ثم false).
 *   - Redis غير متاح → يرجع false فوراً WITHOUT لمس الذاكرة المحلية إطلاقاً.
 *
 * لماذا؟ الذاكرة المحلية غير مشتركة بين نسخ الخادم، فتعطُّل Redis كان يعني
 * أن أي طلب يمرّ كـ "جديد" (لا claim محفوظ) → تضخّم العدّادات بلا حد.
 * مع fail-closed يتوقّف العدّ (بيانات مفقودة) بدل أن يتضخّم (بيانات كاذبة).
 * المقايضة مقصودة: الخطأ الآمن (نحتسب أقل) لا الخطأ الخطير (نحتسب أكثر).
 *
 * ⚠️ الافتراضي يبقى fail-open عن قصد: `src/lib/idempotency.ts` يستدعي
 * redisSetNX كـ "claim" best-effort ويتجاهل القيمة المُعادة — تحويل
 * الافتراضي إلى fail-closed سيعطّل قفل الـ idempotency في الذاكرة بصمت.
 */
export async function redisSetNX(
  key: string,
  ttlSeconds: number,
  opts?: { failClosed?: boolean },
): Promise<boolean> {
  const failClosed = opts?.failClosed === true
  const ttl = normalizeTtl(ttlSeconds)
  const namespaced = redisKey(key)
  let lastErr: unknown = null

  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.set(namespaced, '1', { ex: ttl, nx: true })
        recordRedisSuccess()
        return result === 'OK'
      } catch (err) {
        lastErr = err
        recordRedisFailure()
        // intentional: expected+handled (transient Redis error → retry, then memory fallback); attempt is bounded 1..3
        logger.warn(
          { event: 'redis_setnx_failed', attempt: attempt + 1, err },
          'redis setnx failed',
        )
        if (attempt === 2) {
          logger.warn(
            { event: 'redis_setnx_exhausted', action: 'setnx', attempt: attempt + 1, err },
            'redis setnx failed after 3 attempts — falling back to memory store',
          )
          break
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  } else {
    logger.warn(
      { event: 'redis_setnx_unconfigured', action: 'setnx' },
      process.env.NODE_ENV === 'production'
        ? 'upstash redis غير مُكوَّنة — استخدام الذاكرة المؤقتة لـ deduplication (قد لا تكون مشتركة بين النسخ)'
        : 'upstash redis not configured — using in-memory fallback for setNX (dev/test only), dedup not shared across instances',
    )
  }

  // fail-closed: Redis غير متاح → لا نُنشئ claim إطلاقاً (لا ذاكرة محلية).
  if (failClosed) {
    logger.warn(
      {
        event: 'redis_setnx_failclosed',
        action: 'setnx',
        err: lastErr ?? new Error('upstash redis not configured'),
      },
      'redis unavailable — fail-closed: claim rejected, event NOT counted',
    )
    return false
  }

  const now = Date.now()
  const entry = memoryStore.get(namespaced)
  if (entry && entry.expires >= now) return false
  writeMemory(namespaced, '1', ttl)
  return true
}

const INCR_WITH_TTL_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`

export async function redisIncr(key: string, ttlSeconds: number = 60): Promise<number> {
  const ttl = normalizeTtl(ttlSeconds)
  const namespaced = redisKey(key)
  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.eval(INCR_WITH_TTL_SCRIPT, [namespaced], [ttl])
        const count = Number(result)
        if (!Number.isFinite(count)) throw new Error('redis incr returned a non-numeric value')
        recordRedisSuccess()
        return count
      } catch (err) {
        recordRedisFailure()
        // intentional: expected+handled (transient Redis error → retry, then memory fallback); attempt is bounded 1..3
        logger.warn({ event: 'redis_incr_failed', attempt: attempt + 1, err }, 'redis incr failed')
        if (attempt === 2) {
          logger.warn(
            { event: 'redis_incr_exhausted', action: 'incr', attempt: attempt + 1, err },
            'redis incr failed after 3 attempts — falling back to memory store',
          )
          break
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn(
      { event: 'redis_incr_unconfigured', action: 'incr' },
      'upstash redis غير مُكوَّنة — استخدام الذاكرة المؤقتة لـ rate-limit (قد لا تكون مشتركة بين النسخ)',
    )
  }

  const entry = memoryStore.get(namespaced)
  const now = Date.now()
  if (!entry || entry.expires < now) {
    writeMemory(namespaced, '1', ttl)
    return 1
  }
  const count = parseInt(entry.value, 10) + 1
  entry.value = count.toString()
  writeMemory(namespaced, entry.value, Math.max(1, Math.ceil((entry.expires - now) / 1000)))
  return count
}

/** Real connectivity probe for `/api/health/detailed`. */
export async function redisPing(): Promise<boolean> {
  if (!redisClient) return false
  try {
    const result = await redisClient.ping()
    recordRedisSuccess()
    return result === 'PONG'
  } catch (err) {
    recordRedisFailure()
    logger.warn({ event: 'redis_ping_failed', err }, 'redis ping failed')
    return false
  }
}

export function getRedisInfo() {
  return {
    connected: hasRedis,
    type: redisClient ? 'upstash' : 'in-memory',
    storeSize: memoryStore.size,
  }
}
