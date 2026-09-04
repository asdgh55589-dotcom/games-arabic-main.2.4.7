/**
 * lib/ip-ban-cache.ts — طبقة cache لحظر الـ IP.
 *
 * تُستخدم من:
 *   - server-side (بعد ban/unban) لكتابة/حذف الـ cache
 *   - middleware (Edge) للقراءة فقط عبر Upstash REST
 *
 * التخزين:
 *   - مفتاح: `ipban:<ip>`
 *   - القيمة: JSON { banned: true, expiresAt: string|null }
 *   - TTL: ينتهي مع الحظر المؤقت، أو 90 يوماً للدائم (limit تخزيني)
 *
 * لو Upstash غير مهيّأ، يستخدم memoryStore (fail-open: لو مفيش cache = نسمّح،
 * لكن الفحص الكامل يحدث server-side في requireAuth عبر checkIpBan من DB).
 */

import { redisGet, redisSet, redisDel } from './redis'

export interface IpBanCacheValue {
  banned: boolean
  reason?: string | null
  expiresAt?: string | null // ISO
}

const KEY_PREFIX = 'ipban:'
// TTL قصير للـ cache حتى لو دائم — يضمن عدم نموّ المخزن ويتحقق من DB لاحقاً
const DEFAULT_TTL = 60 * 60 * 24 * 7 // أسبوع

function key(ip: string) {
  return `${KEY_PREFIX}${ip}`
}

function computeTtl(expiresAt: Date | null): number {
  if (!expiresAt) return DEFAULT_TTL
  const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  return Math.max(60, Math.min(seconds, DEFAULT_TTL))
}

/** كتابة حظر IP في الـ cache */
export async function setIpBanCache(
  ip: string,
  value: { banned: boolean; reason?: string | null; expiresAt?: Date | null },
): Promise<void> {
  const payload: IpBanCacheValue = {
    banned: true,
    reason: value.reason,
    expiresAt: value.expiresAt ? value.expiresAt.toISOString() : null,
  }
  await redisSet(key(ip), payload, computeTtl(value.expiresAt || null))
}

/** حذف حظر IP من الـ cache */
export async function deleteIpBanCache(ip: string): Promise<void> {
  await redisDel(key(ip))
}

/** قراءة حالة حظر IP من الـ cache (Edge-safe عبر redisGet) */
export async function getIpBanCache(ip: string): Promise<IpBanCacheValue | null> {
  const cached = await redisGet<IpBanCacheValue>(key(ip))
  if (!cached) return null
  // تحقق من انتهاء الصلاحية
  if (cached.expiresAt) {
    const expires = new Date(cached.expiresAt)
    if (expires <= new Date()) {
      // انتهى — نعتبره غير محظور
      return null
    }
  }
  return cached
}
