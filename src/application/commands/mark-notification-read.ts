/**
 * MarkNotificationReadCommand — أمر تحديد إشعار كمقروء
 */

import type { NotificationRepository } from '@/domain'

export class MarkNotificationReadCommand {
  constructor(private readonly repo: NotificationRepository) {}

  async execute(notificationId: string, userId: string): Promise<boolean> {
    const notification = await this.repo.findById(notificationId)
    if (!notification || notification.userId !== userId) {
      return false
    }
    await this.repo.markAsRead(notificationId)
    return true
  }
}
