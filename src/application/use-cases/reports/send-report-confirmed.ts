/**
 * SendReportConfirmedNotification — إشعار تأكيد بلاغ
 * CRITICAL: Sends ONE notification to target user (fixes the 3-duplicate bug).
 * Also notifies the reporter about the outcome.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ReportConfirmedContext {
  reporterId: string
  targetUserId: string
  reportId: string
  targetType: string
  targetTitle: string
  reason: string
  action: string
  resolution?: string
  moderatorId: string
}

export class SendReportConfirmedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ReportConfirmedContext): Promise<void> {
    // ONE notification to the target user (not 3!)
    // The deduplication policy will handle any duplicates
    // from auto-actions and repeat-offender escalation
    await this.notificationService.send({
      userId: context.targetUserId,
      type: NotificationType.AdminAction,
      actorId: context.moderatorId,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: false,
      data: {
        reportId: context.reportId,
        targetType: context.targetType,
        action: context.action,
      },
      templateVariables: {
        targetTitle: context.targetTitle,
        reason: context.reason,
        action: context.action,
        resolution: context.resolution,
      },
    })

    // Notification to reporter (separate, no dedup needed)
    await this.notificationService.send({
      userId: context.reporterId,
      type: NotificationType.AdminAction,
      actorId: context.moderatorId,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        reportId: context.reportId,
        outcome: 'confirmed',
      },
      templateVariables: {
        targetTitle: context.targetTitle,
        outcome: 'تم تأكيد البلاغ',
      },
    })
  }
}
