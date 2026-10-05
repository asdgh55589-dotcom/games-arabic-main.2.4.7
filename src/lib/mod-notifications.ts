/**
 * lib/mod-notifications.ts — Auto-Notifications for Mod Events
 *
 * Sends notifications when mods change workflow status.
 *
 * P2: لا يكتب صفوف `Notification` مباشرة بعد الآن — كل رسالة تمرّ عبر
 * الكاتب الموحد `sendNotification` (التفضيلات + منع التكرار + مهمة
 * وسجل لكل قناة)، فتصبح مسارات workflow قابلة للتدقيق في
 * /admin/notifications-health مثل بقية الإشعارات.
 */

import { db } from './db'
import { sendNotification } from './notifications/service'
import type { NotificationType } from './notifications/types'
import type { WorkflowStatus } from './workflow'

interface NotifyWorkflowChangeParams {
  modId: string
  modName: string
  modSlug: string
  fromStatus: WorkflowStatus
  toStatus: WorkflowStatus
  changedBy: string
  changedByName: string
  reason?: string
}

/**
 * نوع موجود في قاعدة البيانات من المسار السابق — ليس ضمن قائمة
 * `NotificationType`، لذا يُمرَّر كما هو (القوالب لا تملك له قالباً ⇒ fallback).
 */
const WORKFLOW_NOTIFICATION_TYPE = 'mod_workflow_change' as unknown as NotificationType

interface WorkflowTarget {
  userId: string
  title: string
  message: string
}

/**
 * Send notification when mod workflow status changes.
 */
export async function notifyWorkflowChange(params: NotifyWorkflowChangeParams) {
  const { modId, modName, modSlug, fromStatus, toStatus, changedBy, changedByName, reason } = params

  try {
    // Get the mod author
    const mod = await db.mod.findUnique({
      where: { id: modId },
      select: { authorId: true, reviewerId: true },
    })

    if (!mod) return

    const targets: WorkflowTarget[] = []

    if (toStatus === 'IN_REVIEW') {
      // Mod submitted for review → notify reviewers (admins/managers)
      const reviewers = await db.user.findMany({
        where: { role: { in: ['admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      for (const reviewer of reviewers) {
        if (reviewer.id !== changedBy) {
          targets.push({
            userId: reviewer.id,
            title: 'تعريب جديد للمراجعة',
            message: `${changedByName} أرسل "${modName}" للمراجعة`,
          })
        }
      }
    } else if (toStatus === 'APPROVED') {
      // Mod approved → notify author
      if (mod.authorId !== changedBy) {
        targets.push({
          userId: mod.authorId,
          title: 'تمت الموافقة على التعريب',
          message: `تمت الموافقة على "${modName}" من قبل ${changedByName}`,
        })
      }
    } else if (toStatus === 'REJECTED') {
      // Mod rejected → notify author with reason
      if (mod.authorId !== changedBy) {
        targets.push({
          userId: mod.authorId,
          title: 'تم رفض التعريب',
          message: `تم رفض "${modName}"${reason ? `. السبب: ${reason}` : ''}`,
        })
      }
    } else if (toStatus === 'PUBLISHED') {
      // Mod published → notify author
      if (mod.authorId !== changedBy) {
        targets.push({
          userId: mod.authorId,
          title: 'تم نشر التعريب',
          message: `تم نشر "${modName}" بنجاح`,
        })
      }
    }

    if (targets.length === 0) return

    // المستلمون الذين تتطابق رسالتهم يذهبون في استدعاء واحد
    const groups = new Map<string, { title: string; message: string; userIds: string[] }>()
    for (const target of targets) {
      const key = `${target.title}\u0000${target.message}`
      const existing = groups.get(key)
      if (existing) {
        existing.userIds.push(target.userId)
      } else {
        groups.set(key, { title: target.title, message: target.message, userIds: [target.userId] })
      }
    }

    for (const group of groups.values()) {
      await sendNotification({
        type: WORKFLOW_NOTIFICATION_TYPE,
        title: group.title,
        message: group.message,
        data: { modId, modSlug, fromStatus, toStatus },
        recipients: group.userIds.map((userId) => ({ userId, channels: ['in_app'] })),
        actorId: changedBy,
        actorUsername: changedByName,
        targetType: 'mod',
        targetId: modId,
        targetSlug: modSlug,
        targetTitle: modName,
        targetUrl: `/mod/${modSlug}`,
      })
    }
  } catch (err) {
    console.error('[mod-notifications] failed:', err)
  }
}
