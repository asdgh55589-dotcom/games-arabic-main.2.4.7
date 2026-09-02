/**
 * lib/mod-notifications.ts — Auto-Notifications for Mod Events
 *
 * Sends notifications when mods change workflow status.
 * Uses the existing Notification system.
 */

import { db } from './db'
import { WORKFLOW_LABELS, type WorkflowStatus } from './workflow'

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

    const notifications: Array<{ userId: string; title: string; message: string }> = []

    if (toStatus === 'IN_REVIEW') {
      // Mod submitted for review → notify reviewers (admins/managers)
      const reviewers = await db.user.findMany({
        where: { role: { in: ['admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      for (const reviewer of reviewers) {
        if (reviewer.id !== changedBy) {
          notifications.push({
            userId: reviewer.id,
            title: 'تعريب جديد للمراجعة',
            message: `${changedByName} أرسل "${modName}" للمراجعة`,
          })
        }
      }
    } else if (toStatus === 'APPROVED') {
      // Mod approved → notify author
      if (mod.authorId !== changedBy) {
        notifications.push({
          userId: mod.authorId,
          title: 'تمت الموافقة على التعريب',
          message: `تمت الموافقة على "${modName}" من قبل ${changedByName}`,
        })
      }
    } else if (toStatus === 'REJECTED') {
      // Mod rejected → notify author with reason
      if (mod.authorId !== changedBy) {
        notifications.push({
          userId: mod.authorId,
          title: 'تم رفض التعريب',
          message: `تم رفض "${modName}"${reason ? `. السبب: ${reason}` : ''}`,
        })
      }
    } else if (toStatus === 'PUBLISHED') {
      // Mod published → notify author
      if (mod.authorId !== changedBy) {
        notifications.push({
          userId: mod.authorId,
          title: 'تم نشر التعريب',
          message: `تم نشر "${modName}" بنجاح`,
        })
      }
    }

    // Create notifications in database with target fields
    for (const notif of notifications) {
      await db.notification.create({
        data: {
          userId: notif.userId,
          actorId: changedBy,
          type: 'mod_workflow_change',
          title: notif.title,
          message: notif.message,
          data: {
            modId,
            modSlug,
            fromStatus,
            toStatus,
          },
          targetType: 'mod',
          targetId: modId,
          targetSlug: modSlug,
          targetTitle: modName,
          targetUrl: `/mod/${modSlug}`,
          actorUsername: changedByName,
        },
      })
    }
  } catch (err) {
    console.error('[mod-notifications] failed:', err)
  }
}
