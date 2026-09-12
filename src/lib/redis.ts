/**
 * lib/redis.ts — اتصال Redis عبر Upstash (serverless, HTTP-based).
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

let redisClient: Redis | null = null
if (hasRedis) {
  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// استخدام globalThis لضمان مشاركة الذاكرة بين جميع الـ routes وتجاوز HMR/Turbopack isolation
const _global = globalThis as unknown as {
  __memoryStore?: Map<string, { value: string; expires: number }>
}
const memoryStore: Map<string, { value: string; expires: number }> =
  _global.__memoryStore ??
  (_global.__memoryStore = new Map<string, { value: string; expires: number }>())

export async function redisGet<T>(key: string): Promise<T | null> {
  if (redisClient) {
    try {
      const result = await redisClient.get<T>(key)
      return result
    } catch (err) {
      // intentional: expected+handled (Redis down → in-memory fallback below); key omitted — dedup keys may embed user identity
      logger.warn({ event: 'redis_get_failed', err }, 'redis get failed, using memory fallback')
    }
  }
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    memoryStore.delete(key)
    return null
  }
  try {
    return JSON.parse(entry.value) as T
  } catch (err) {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: corrupt memory entry is self-healing — treated as cache miss
    // intentional: expected+handled (stale/corrupt entry → miss, no value to preserve)
    logger.warn({ event: 'redis_memory_parse_failed', err }, 'redis memory entry unparseable')
    return null
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = 60,
): Promise<void> {
  const stringValue = JSON.stringify(value)
  if (redisClient) {
    try {
      await redisClient.set(key, stringValue, { ex: ttlSeconds })
      return
    } catch (err) {
      // intentional: expected+handled (Redis down → in-memory fallback below)
      logger.warn({ event: 'redis_set_failed', err }, 'redis set failed, using memory fallback')
    }
  }
  memoryStore.set(key, { value: stringValue, expires: Date.now() + ttlSeconds * 1000 })
  if (memoryStore.size > 500) {
    const keys = Array.from(memoryStore.keys())
    for (let i = 0; i < 250; i++) memoryStore.delete(keys[i])
  }
}

export async function redisDel(key: string): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.del(key)
      return
    } catch (err) {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: delete is idempotent — memory fallback below converges to the same state
      // intentional: expected+handled (fall through to memory delete)
      logger.warn({ event: 'redis_del_failed', err }, 'redis del failed, using memory fallback')
    }
  }
  memoryStore.delete(key)
}

/**
 * SET NX — ينجح مرة واحدة فقط لكل مفتاح (للـ dedup).
 * يرجع true إذا كان المفتاح جديداً (أول مرة)، false إذا كان موجوداً.
 * مع fallback سلس إلى الذاكرة عند عدم توفر Redis — يعمل مع أو بدون Upstash
 * مع retry 3 مرات عند استخدام Upstash.
 */
export async function redisSetNX(key: string, ttlSeconds: number): Promise<boolean> {
  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.set(key, '1', { ex: ttlSeconds, nx: true })
        return result === 'OK'
      } catch (err) {
        // intentional: expected+handled (transient Redis error → retry, then memory fallback); attempt is bounded 1..3
        logger.warn({ event: 'redis_setnx_failed', attempt: attempt + 1, err }, 'redis setnx failed')
        if (attempt === 2) {
          console.warn('[Redis] فشل Redis لـ deduplication — التحويل للذاكرة المؤقتة')
          break
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[Redis] بيانات Upstash غير مُكوَّنة — استخدام الذاكرة المؤقتة لـ deduplication (قد لا تكون مشتركة بين النسخ)',
      )
    } else {
      console.warn(
        '[redis] Using in-memory fallback for setNX (dev/test only) - dedup not shared across instances',
      )
    }
  }
  // Fallback للذاكرة — مسموح فقط في dev/test
  const now = Date.now()
  if (memoryStore.size > 5000) {
    for (const [k, v] of memoryStore) {
      if (v.expires < now) memoryStore.delete(k)
      if (memoryStore.size <= 4000) break
    }
    if (memoryStore.size > 8000) memoryStore.clear()
  }
  const entry = memoryStore.get(key)
  if (entry && entry.expires >= now) return false
  memoryStore.set(key, { value: '1', expires: now + ttlSeconds * 1000 })
  return true
}

export async function redisIncr(key: string, ttlSeconds: number = 60): Promise<number> {
  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.incr(key)
        if (result === 1) await redisClient.expire(key, ttlSeconds)
        return result
      } catch (err) {
        // intentional: expected+handled (transient Redis error → retry, then memory fallback); attempt is bounded 1..3
        logger.warn({ event: 'redis_incr_failed', attempt: attempt + 1, err }, 'redis incr failed')
        if (attempt === 2) {
          console.warn('[Redis] فشل Redis لـ rate-limit — التحويل للذاكرة المؤقتة')
          break
        }
        await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
      }
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[Redis] بيانات Upstash غير مُكوَّنة — استخدام الذاكرة المؤقتة لـ rate-limit (قد لا تكون مشتركة بين النسخ)',
      )
    }
  }
  const entry = memoryStore.get(key)
  const now = Date.now()
  if (!entry || entry.expires < now) {
    memoryStore.set(key, { value: '1', expires: now + ttlSeconds * 1000 })
    return 1
  }
  const count = parseInt(entry.value, 10) + 1
  entry.value = count.toString()
  memoryStore.set(key, entry)
  return count
}

export function getRedisInfo() {
  return {
    connected: hasRedis,
    type: redisClient ? 'upstash' : 'in-memory',
    storeSize: memoryStore.size,
  }
}

export { redisClient }
