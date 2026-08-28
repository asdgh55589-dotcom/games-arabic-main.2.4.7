/**
 * DeleteOldNotificationsCommand — أمر حذف الإشعارات القديمة
 */

import type { NotificationRepository } from '@/domain'

export class DeleteOldNotificationsCommand {
  constructor(private readonly repo: NotificationRepository) {}

  /**
   * Delete read notifications older than the specified number of days.
   */
  async execute(userId: string, olderThanDays: number = 90): Promise<number> {
    // This is a placeholder — the actual implementation will use
    // the repository's delete method with a date filter.
    // For now, we'll just return 0.
    void userId
    void olderThanDays
    return 0
  }
}
