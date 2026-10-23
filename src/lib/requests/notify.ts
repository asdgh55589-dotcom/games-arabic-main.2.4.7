import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { ModRequestStatus } from './state-machine'

interface NotifyModRequestParams {
  requestId: string
  gameName: string
  requesterId: string
  /** Translator/assignee at the time of the decision (may be cleared by it). */
  assigneeId?: string | null
  actorId: string
  from: string
  to: ModRequestStatus
  reason?: string | null
}

interface Copy {
  title: string
  message: string
}

function buildCopy(params: NotifyModRequestParams): Copy {
  const reasonSuffix = params.reason?.trim() ? ` — السبب: ${params.reason.trim()}` : ''
  switch (params.to) {
    case 'accepted':
      return {
        title: '✅ تم قبول طلب التعريب',
        message: `تم قبول طلب تعريب "${params.gameName}"${reasonSuffix}`,
      }
    case 'in_progress':
      return {
        title: '🚀 بدأ العمل على طلب التعريب',
        message: `بدأ العمل على تعريب "${params.gameName}"${reasonSuffix}`,
      }
    case 'completed':
      return {
        title: '🎊 تعريبك جاهز!',
        message: `تم إكمال تعريب "${params.gameName}"${reasonSuffix}`,
      }
    case 'rejected':
      return {
        title: '❌ تم رفض طلب التعريب',
        message: `تم رفض طلب تعريب "${params.gameName}"${reasonSuffix}`,
      }
    case 'cancelled':
      return {
        title: '❌ تم إغلاق طلب التعريب',
        message: `تم إغلاق طلب تعريب "${params.gameName}"${reasonSuffix}`,
      }
    default:
      return {
        title: 'ℹ️ تحديث حالة طلب التعريب',
        message: `تم تحديث حالة طلب تعريب "${params.gameName}"${reasonSuffix}`,
      }
  }
}

/**
 * Notify the requester and the assigned translator (deduplicated) after an
 * admin decision. Best-effort: notification failures never fail the decision.
 */
export async function notifyModRequestParticipants(params: NotifyModRequestParams): Promise<void> {
  const { title, message } = buildCopy(params)
  const recipients = new Set<string>([params.requesterId])
  if (params.assigneeId) recipients.add(params.assigneeId)

  for (const userId of recipients) {
    try {
      await db.notification.create({
        data: {
          userId,
          actorId: params.actorId,
          type: 'system_announcement',
          title,
          message,
          data: {
            requestId: params.requestId,
            from: params.from,
            to: params.to,
            ...(params.reason?.trim() ? { reason: params.reason.trim() } : {}),
          },
        },
      })
    } catch (err) {
      logger.warn(
        { event: 'mod_request_notify_failed', requestId: params.requestId, userId, err },
        'mod request notify failed',
      )
    }
  }
}
