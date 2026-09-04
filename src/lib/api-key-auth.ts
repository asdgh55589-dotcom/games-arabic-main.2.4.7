/**
 * lib/api-key-auth.ts — مصادقة بالمفتاح البرمجي (API Key)
 *
 * يتحقق من Authorization: Bearer <api_key> header
 * ويُرجع SessionUser شرحاً صحيحاً إذا كان المفتاح ساري المفعول.
 *
 * الاستخدام: يُستدعى من getSession() كبديل للـ cookie/Supabase auth
 */

import { db } from './db'
import { logger } from './logger'
import type { SessionUser, UserRole } from './auth'

// ===== Types =====

export interface ApiKeyAuthResult {
  valid: true
  user: SessionUser
  apiKeyId: string
}

// ===== Main Function =====

/**
 * التحقق من API Key من Authorization header
 * @param authHeader - قيمة Authorization header (قد تبدأ بـ "Bearer " أو لا)
 * @returns SessionUser إذا كان المفتاح ساري المفعول، أو null
 */
export async function authenticateApiKey(
  authHeader: string | null,
): Promise<ApiKeyAuthResult | null> {
  if (!authHeader) return null

  // استخراج المفتاح: يدعم "Bearer <key>" أو "<key>" مباشرة
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim()

  // التحقق من الصيغة: sk_live_...
  if (!key || !key.startsWith('sk_live_')) return null

  try {
    // البحث عن المفتاح في قاعدة البيانات
    const apiKey = await db.apiKey.findUnique({
      where: { key },
      select: {
        id: true,
        userId: true,
        role: true,
        expiresAt: true,
        isActive: true,
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
          },
        },
      },
    })

    if (!apiKey) return null

    // فحص التنشيط
    if (!apiKey.isActive) {
      logger.warn(`[ApiKeyAuth] Deactivated key used: ${apiKey.id}`)
      return null
    }

    // فحص الانتهاء
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      logger.warn(`[ApiKeyAuth] Expired key used: ${apiKey.id}`)
      return null
    }

    // فحص حظر المستخدم
    if (apiKey.user.banStatus && apiKey.user.banStatus !== 'active') {
      return null
    }

    // تحديث lastUsedAt بشكل غير متزامن (non-blocking)
    db.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        logger.error('[ApiKeyAuth] Failed to update lastUsedAt', err)
      })

    // إرجاع SessionUser
    return {
      valid: true,
      user: {
        id: apiKey.user.id,
        username: apiKey.user.username,
        email: apiKey.user.email,
        role: apiKey.role as UserRole, // الدور الممنوح من المفتاح
        avatarUrl: apiKey.user.avatarUrl,
      },
      apiKeyId: apiKey.id,
    }
  } catch (err) {
    logger.error('[ApiKeyAuth] Database error', err)
    return null
  }
}
