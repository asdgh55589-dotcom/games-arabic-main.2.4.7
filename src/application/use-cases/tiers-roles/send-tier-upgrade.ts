/**
 * SendTierUpgradeNotification — إشعار ترقية مستوى
 * Notifies the user when their tier is upgraded.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface TierUpgradeContext {
  userId: string
  fromTier: number
  fromTierName: string
  toTier: number
  toTierName: string
  reason?: string
}

export class SendTierUpgradeNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: TierUpgradeContext): Promise<void> {
    await this.notificationService.send({
      userId: context.userId,
      type: NotificationType.TierUpgrade,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      data: {
        fromTier: context.fromTier,
        toTier: context.toTier,
        reason: context.reason,
      },
      templateVariables: {
        fromTierName: context.fromTierName,
        toTierName: context.toTierName,
      },
    })
  }
}
