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

import { redisDel, redisGet, redisSet } from './redis'

interface TokenVersionCacheValue {
  tv: number
}

const KEY_PREFIX = 'tv:'
const DEFAULT_TTL = 60 * 60 * 24 * 7 // 7 days

function key(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

/**
 * Write tokenVersion to cache (Edge-readable).
 *
 * On failure we delete the key instead of leaving the old positive value in
 * place: a miss makes strict Edge checks fail closed, while a stale hit would
 * let an invalidated session keep working for up to 7 days.
 */
export async function setTokenVersionCache(userId: string, tv: number): Promise<boolean> {
  const written = await redisSet(key(userId), { tv } satisfies TokenVersionCacheValue, DEFAULT_TTL)
  if (!written) await redisDel(key(userId))
  return written
}

/** Read tokenVersion from cache (Edge-safe via redisGet) */
export async function getTokenVersionCache(userId: string): Promise<number | null> {
  const cached = await redisGet<TokenVersionCacheValue>(key(userId))
  return cached?.tv ?? null
}
