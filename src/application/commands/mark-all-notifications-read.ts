/**
 * MarkAllNotificationsReadCommand — أمر تحديد كل الإشعارات كمقروءة
 */

import type { NotificationRepository } from '@/domain'

export class MarkAllNotificationsReadCommand {
  constructor(private readonly repo: NotificationRepository) {}

  async execute(userId: string): Promise<number> {
    const unreadCount = await this.repo.findUnreadCount(userId)
    await this.repo.markAllAsRead(userId)
    return unreadCount
  }
}
