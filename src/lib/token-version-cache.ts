/**
 * lib/token-version-cache.ts — طبقة cache لـ tokenVersion.
 *
 * تُستخدم من:
 *   - server-side (بعد invalidateUserSessions) لكتابة الـ cache
 *   - middleware (Edge) للقراءة فقط عبر Upstash REST
 *
 * التخزين:
 *   - مفتاح: `tv:<userId>`
 *   - القيمة: JSON { tv: number }
 *   - TTL: 7 أيام (تطابق JWT expiry)
 *
 * لو Upstash غير مهيّأ، يستخدم memoryStore (fail-open: لو مفيش cache = نسمّح，
 * لكن الفحص الكامل يحدث server-side في getSession عبر tokenVersion من DB).
 */

import { redisGet, redisSet } from './redis'

interface TokenVersionCacheValue {
  tv: number
}

const KEY_PREFIX = 'tv:'
const DEFAULT_TTL = 60 * 60 * 24 * 7 // 7 days

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

/** Write tokenVersion to cache (Edge-readable) */
export async function setTokenVersionCache(userId: string, tv: number): Promise<void> {
  await redisSet(key(userId), { tv } satisfies TokenVersionCacheValue, DEFAULT_TTL)
}

/** Read tokenVersion from cache (Edge-safe via redisGet) */
export async function getTokenVersionCache(userId: string): Promise<number | null> {
  const cached = await redisGet<TokenVersionCacheValue>(key(userId))
  return cached?.tv ?? null
}
