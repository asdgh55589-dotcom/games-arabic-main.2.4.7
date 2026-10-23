/**
 * lib/redis.ts — اتصال Redis عبر Upstash (serverless, HTTP-based).
 */

import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

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

/** Every write must carry a positive TTL — reject NaN/0/negative values. */
function normalizeTtl(ttlSeconds: number): number {
  return Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? Math.floor(ttlSeconds) : 60
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
  const ttl = normalizeTtl(ttlSeconds)
  const stringValue = JSON.stringify(value)
  if (redisClient) {
    try {
      await redisClient.set(key, stringValue, { ex: ttl })
      return
    } catch (err) {
      // intentional: expected+handled (Redis down → in-memory fallback below)
      logger.warn({ event: 'redis_set_failed', err }, 'redis set failed, using memory fallback')
    }
  }
  memoryStore.set(key, { value: stringValue, expires: Date.now() + ttl * 1000 })
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
  let lastErr: unknown = null

  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.set(key, '1', { ex: ttl, nx: true })
        return result === 'OK'
      } catch (err) {
        lastErr = err
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
  memoryStore.set(key, { value: '1', expires: now + ttl * 1000 })
  return true
}

export async function redisIncr(key: string, ttlSeconds: number = 60): Promise<number> {
  const ttl = normalizeTtl(ttlSeconds)
  if (hasRedis && redisClient) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await redisClient.incr(key)
        if (result === 1) {
          try {
            await redisClient.expire(key, ttl)
          } catch (expireErr) {
            await redisClient.del(key).catch(() => {})
            throw expireErr
          }
        }
        return result
      } catch (err) {
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
  } else {
    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        { event: 'redis_incr_unconfigured', action: 'incr' },
        'upstash redis غير مُكوَّنة — استخدام الذاكرة المؤقتة لـ rate-limit (قد لا تكون مشتركة بين النسخ)',
      )
    }
  }
  const entry = memoryStore.get(key)
  const now = Date.now()
  if (!entry || entry.expires < now) {
    memoryStore.set(key, { value: '1', expires: now + ttl * 1000 })
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
