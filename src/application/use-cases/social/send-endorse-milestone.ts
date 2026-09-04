/**
 * SendEndorseMilestoneNotification — إشعار إنجاز تصويت
 * Notifies the mod author when their mod reaches an endorsement milestone.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface EndorseMilestoneContext {
  modAuthorId: string
  modId: string
  modTitle: string
  modSlug: string
  milestone: number
}

export class SendEndorseMilestoneNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: EndorseMilestoneContext): Promise<void> {
    await this.notificationService.send({
      userId: context.modAuthorId,
      type: NotificationType.ModEndorseMilestone,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      data: {
        modId: context.modId,
        modSlug: context.modSlug,
        milestone: context.milestone,
      },
      templateVariables: {
        modTitle: context.modTitle,
        milestone: context.milestone,
        modUrl: `/mod/${context.modSlug}`,
      },
    })
  }
}
