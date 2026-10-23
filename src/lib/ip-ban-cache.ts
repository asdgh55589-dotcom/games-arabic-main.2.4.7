/**
 * lib/ip-ban-cache.ts — طبقة cache لحظر الـ IP.
 *
 * تُستخدم من:
 *   - server-side (بعد ban/unban) لكتابة/حذف الـ cache
 *   - middleware (Edge) للقراءة فقط عبر Upstash REST
 *
 * التخزين:
 *   - مفتاح: `ipban:<sha256(ip)>` (لا IP خام في Redis)
 *   - القيمة: JSON { banned: true, expiresAt: string|null }
 *   - TTL: ينتهي مع الحظر المؤقت، أو 90 يوماً للدائم
 *
 * لو Upstash غير مهيّأ، يستخدم memoryStore. مسارات الكتابة الحساسة تتحقق
 * أيضاً من DB في Node (المصدر الموثوق)؛ Edge cache مجرد تسريع.
 */

import { hashRedisIdentifier, redisDel, redisGetSafe, redisSet } from './redis'

export interface IpBanCacheValue {
  banned: boolean
  reason?: string | null
  expiresAt?: string | null // ISO
}

export type IpBanCacheStatus = 'hit' | 'miss' | 'unavailable'

export interface IpBanCacheResult {
  status: IpBanCacheStatus
  value: IpBanCacheValue | null
}

const KEY_PREFIX = 'ipban:'
const PERMANENT_TTL = 60 * 60 * 24 * 90 // 90 days for permanent bans

async function key(ip: string): Promise<string> {
  return `${KEY_PREFIX}${await hashRedisIdentifier(ip)}`
}

function computeTtl(expiresAt: Date | null): number {
  if (!expiresAt) return PERMANENT_TTL
  const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
  return Math.max(60, Math.min(seconds, PERMANENT_TTL))
}

/** كتابة حظر IP في الـ cache. Returns false when Redis is unavailable. */
export async function setIpBanCache(
  ip: string,
  value: { banned: boolean; reason?: string | null; expiresAt?: Date | null },
): Promise<boolean> {
  const payload: IpBanCacheValue = {
    banned: true,
    reason: value.reason,
    expiresAt: value.expiresAt ? value.expiresAt.toISOString() : null,
  }
  return redisSet(await key(ip), payload, computeTtl(value.expiresAt || null))
}

/** حذف حظر IP من الـ cache. Returns false when Redis is unavailable. */
export async function deleteIpBanCache(ip: string): Promise<boolean> {
  return redisDel(await key(ip))
}

/** Strict read used by the Edge write path (distinguishes miss from outage). */
export async function getIpBanCacheResult(ip: string): Promise<IpBanCacheResult> {
  const result = await redisGetSafe<IpBanCacheValue>(await key(ip))
  if (!result.ok) return { status: 'unavailable', value: null }
  if (!result.value) return { status: 'miss', value: null }
  if (result.value.expiresAt) {
    const expires = new Date(result.value.expiresAt)
    if (expires <= new Date()) return { status: 'miss', value: null }
  }
  return { status: 'hit', value: result.value }
}

/** Backwards-compatible permissive read (GET/session paths). */
export async function getIpBanCache(ip: string): Promise<IpBanCacheValue | null> {
  const result = await getIpBanCacheResult(ip)
  return result.status === 'hit' ? result.value : null
}
