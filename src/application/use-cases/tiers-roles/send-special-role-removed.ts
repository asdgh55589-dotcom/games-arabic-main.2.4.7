/**
 * SendSpecialRoleRemovedNotification — إشعار سحب دور خاص
 * Notifies the user when a special role is removed from them.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface SpecialRoleRemovedContext {
  userId: string
  roleKey: string
  roleName: string
  removedBy: string
}

export class SendSpecialRoleRemovedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: SpecialRoleRemovedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.userId,
      type: NotificationType.SpecialRoleRemoved,
      actorId: context.removedBy,
      channels: [NotificationChannel.InApp, NotificationChannel.Email],
      data: {
        roleKey: context.roleKey,
      },
      templateVariables: {
        roleName: context.roleName,
      },
    })
  }
}
