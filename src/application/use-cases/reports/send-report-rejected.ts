/**
 * SendReportRejectedNotification — إشعار رفض بلاغ
 * Notifies the reporter that their report was rejected.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface ReportRejectedContext {
  reporterId: string
  reportId: string
  targetType: string
  targetTitle: string
  reason: string
  resolution?: string
  moderatorId: string
}

export class SendReportRejectedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: ReportRejectedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.reporterId,
      type: NotificationType.AdminAction,
      actorId: context.moderatorId,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        reportId: context.reportId,
        outcome: 'rejected',
      },
      templateVariables: {
        targetTitle: context.targetTitle,
        outcome: 'تم رفض البلاغ',
        resolution: context.resolution,
      },
    })
  }
}
