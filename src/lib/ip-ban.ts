/**
 * lib/ip-ban.ts — authoritative IP-ban check (Node runtime only).
 *
 * The Edge middleware cache is a fast path. Sensitive Node route handlers call
 * this helper so a cache miss/outage cannot silently disable a permanent ban.
 */

import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export function getRequestIp(req: { headers?: Headers } | null | undefined): string | null {
  const headers = req?.headers
  if (!headers || typeof headers.get !== 'function') return null
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  return headers.get('x-real-ip')?.trim() || null
}

export async function isIpBannedInDb(ip: string | null): Promise<boolean> {
  if (!ip || ip === 'unknown') return false
  // Test doubles and partial clients may not expose the model.
  if (!db.ipBan?.findUnique) return false
  try {
    const ban = await db.ipBan.findUnique({
      where: { ipAddress: ip },
      select: { expiresAt: true },
    })
    if (!ban) return false
    if (ban.expiresAt && ban.expiresAt <= new Date()) return false
    return true
  } catch (err) {
    // DB unavailable: fail closed for security-sensitive callers.
    logger.error({ event: 'ip_ban_db_check_failed', err }, 'IP ban DB check failed')
    return true
  }
}

export async function isRequestIpBanned(req: { headers?: Headers } | null | undefined): Promise<boolean> {
  return isIpBannedInDb(getRequestIp(req))
}
