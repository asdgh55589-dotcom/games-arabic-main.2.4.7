/**
 * SendTierRevokedNotification — إشعار سحب مستوى
 * Notifies the user when their tier is revoked.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface TierRevokedContext {
  userId: string
  revokedBy: string
  reason?: string
}

export class SendTierRevokedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: TierRevokedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.userId,
      type: NotificationType.TierRevoked,
      actorId: context.revokedBy,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      skipDeduplication: true,
      data: {
        reason: context.reason,
      },
      templateVariables: {
        reason: context.reason,
      },
    })
  }
}
