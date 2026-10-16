/**
 * lib/social/publish-routes.ts — تحقق مشترك لقواعد التوجيه (إنشاء/تعديل).
 *
 * القواعد الصلبة:
 *  - الوجهة موجودة وغير مؤرشفة، ونوعها قابل للنشر (channel/group/supergroup).
 *  - targetType متوافق مع نوع الوجهة؛ topic يتطلب threadId صالحاً
 *    (يُعاد استخدام validateDestinationThread بصرامة المرحلة 1).
 *  - البوت المُسنَد موجود إن ذُكر (الحالة تُفحص عند الإرسال لا هنا).
 */

import { db } from '@/lib/db'
import { PLATFORMS } from '@/lib/constants'
import { validateDestinationThread } from '@/lib/telegram-destinations'

export const ROUTE_TARGET_TYPES = ['channel', 'group', 'topic'] as const
export type RouteTargetType = (typeof ROUTE_TARGET_TYPES)[number]

export const PLATFORM_KEYS = new Set(PLATFORMS.map((p) => p.key))

export interface RouteTargetCheck {
  ok: boolean
  code?: string
  message?: string
  details?: Record<string, string>
  destination?: {
    id: string
    chatId: string
    chatType: string
    lastHealthAt: Date | null
    lastHealthError: string | null
  }
}

export async function checkRouteTarget(input: {
  destinationId: string
  targetType: string
  threadId?: number | null
  botId?: string | null
}): Promise<RouteTargetCheck> {
  const destination = await db.telegramDestination.findUnique({
    where: { id: input.destinationId },
    select: {
      id: true,
      chatId: true,
      chatType: true,
      archivedAt: true,
      verificationStatus: true,
      lastHealthAt: true,
      lastHealthError: true,
    },
  })
  if (!destination || destination.archivedAt) {
    const message = !destination
      ? 'الوجهة غير موجودة'
      : 'الوجهة مؤرشفة — استعدها أولاً أو اختر وجهة نشطة'
    return { ok: false, code: 'VALIDATION_ERROR', message, details: { destinationId: message } }
  }
  // قواعد التوجيه تُبنى على الموثقة فقط — غير الموثقة تفشل عند الإرسال حتماً.
  if (destination.verificationStatus !== 'verified') {
    const message = 'الوجهة غير موثقة — وثّقها من صفحة الوجهات أولاً ثم اربطها'
    return { ok: false, code: 'VALIDATION_ERROR', message, details: { destinationId: message } }
  }

  // توافق النوع: القناة للقناة، والمجموعة للمجموعة/الخارقة، والموضوع بthread.
  const chatType = destination.chatType
  if (input.targetType === 'channel' && chatType !== 'channel') {
    const message = 'نوع الهدف «قناة» لا يطابق نوع الوجهة — اختر وجهة قناة'
    return { ok: false, code: 'VALIDATION_ERROR', message, details: { targetType: message } }
  }
  if (input.targetType === 'group' && chatType !== 'group' && chatType !== 'supergroup') {
    const message = 'نوع الهدف «مجموعة» لا يطابق نوع الوجهة — اختر وجهة مجموعة'
    return { ok: false, code: 'VALIDATION_ERROR', message, details: { targetType: message } }
  }
  if (input.targetType === 'topic') {
    if (input.threadId == null) {
      const message = 'هدف الموضوع يتطلب threadId'
      return { ok: false, code: 'VALIDATION_ERROR', message, details: { threadId: message } }
    }
    const threadCheck = validateDestinationThread(chatType, input.threadId, {
      canonicalId: destination.chatId,
      healthConfirmed:
        destination.lastHealthAt != null && destination.lastHealthError == null,
    })
    if (!threadCheck.ok) {
      return {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: threadCheck.message,
        details: { threadId: threadCheck.message },
      }
    }
  }

  if (input.botId) {
    const bot = await db.socialTelegramBot.findUnique({
      where: { id: input.botId },
      select: { id: true },
    })
    if (!bot) {
      const message = 'البوت المحدد غير موجود —�محدد غير موجود — اختر بوتاً من القائمة أو اتركه فارغاً'
      return { ok: false, code: 'VALIDATION_ERROR', message, details: { botId: message } }
    }
  }

  return { ok: true, destination }
}
