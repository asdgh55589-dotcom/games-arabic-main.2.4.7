/**
 * SendReportSubmittedNotification — إشعار بلاغ جديد
 * Notifies all admins when a new report is submitted.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ReportSubmittedContext {
  adminUserIds: string[]
  reporterId: string
  reportId: string
  targetType: string
  targetTitle: string
  reason: string
}

export class SendReportSubmittedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ReportSubmittedContext): Promise<void> {
    // Send to all admins
    for (const adminId of context.adminUserIds) {
      await this.notificationService.send({
        userId: adminId,
        type: NotificationType.AdminReport,
        actorId: context.reporterId,
        channels: [NotificationChannel.InApp],
        skipDeduplication: true,
        data: {
          reportId: context.reportId,
          targetType: context.targetType,
        },
        templateVariables: {
          targetType: context.targetType,
          targetTitle: context.targetTitle,
          reason: context.reason,
        },
      })
    }
  }
}
