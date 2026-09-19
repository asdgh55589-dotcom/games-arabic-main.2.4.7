/**
 * lib/notification-cache.ts — unread-count cache for the single polling channel.
 *
 * The polling hook hits /api/notifications/unread-count every 30s per tab.
 * This 60s server-side cache collapses those (plus multi-bell instances)
 * into ~1 DB query/min per user. Invalidated on read / read-all.
 */

import { redisDel, redisGet, redisSet } from '@/lib/redis'

const UNREAD_TTL_S = 60

export function unreadCacheKey(userId: string): string {
  return `notifications:unread:${userId}`
}

export async function getCachedUnreadCount(userId: string): Promise<number | null> {
  try {
    return await redisGet<number>(unreadCacheKey(userId))
  } catch {
    return null
  }
}

export async function setCachedUnreadCount(userId: string, count: number): Promise<void> {
  try {
    await redisSet(unreadCacheKey(userId), count, UNREAD_TTL_S)
  } catch {
    // fail-open: cache miss next poll
  }
}

export async function invalidateUnreadCache(userId: string): Promise<void> {
  if (!userId) return
  try {
    await redisDel(unreadCacheKey(userId))
  } catch {
    // fail-open: 60s TTL converges anyway
  }
}
