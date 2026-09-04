/**
 * SendSystemAnnouncementNotification — إشعار إعلان النظام
 * Broadcasts a system announcement to all users.
 */

import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '../../services'

export interface SystemAnnouncementContext {
  userIds: string[]
  title: string
  message: string
  link?: string
}

export class SendSystemAnnouncementNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(context: SystemAnnouncementContext): Promise<void> {
    for (const userId of context.userIds) {
      await this.notificationService.send({
        userId,
        type: NotificationType.SystemAnnouncement,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
        skipDeduplication: true,
        title: context.title,
        message: context.message,
        data: context.link ? { link: context.link } : undefined,
      })
    }
  }
}
