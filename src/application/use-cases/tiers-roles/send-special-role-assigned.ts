/**
 * SendSpecialRoleAssignedNotification — إشعار منح دور خاص
 * Notifies the user when a special role is assigned to them.
 */

import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../../services'

export interface SpecialRoleAssignedContext {
  userId: string
  roleKey: string
  roleName: string
  assignedBy: string
}

export class SendSpecialRoleAssignedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: SpecialRoleAssignedContext): Promise<void> {
    await this.notificationService.send({
      userId: context.userId,
      type: NotificationType.SpecialRoleAssigned,
      actorId: context.assignedBy,
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
