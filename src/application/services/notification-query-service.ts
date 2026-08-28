/**
 * NotificationQueryService — خدمة استعلامات الإشعار
 * Read-only queries for notifications.
 */

import type { NotificationRepository } from '@/domain'
import type { NotificationOutput, PaginatedNotificationOutput } from '../dto'

export class NotificationQueryService {
  constructor(private readonly repo: NotificationRepository) {}

  /**
   * Get paginated notifications for a user.
   */
  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedNotificationOutput> {
    const [notifications, unreadCount] = await Promise.all([
      this.repo.findByUserId(userId, { page, limit }),
      this.repo.findUnreadCount(userId),
    ])

    return {
      notifications: notifications.map(n => this.toOutput(n)),
      pagination: {
        page,
        limit,
        total: unreadCount,
        totalPages: Math.ceil(unreadCount / limit) || 1,
      },
      unreadCount,
    }
  }

  /**
   * Get unread notification count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.findUnreadCount(userId)
  }

  private toOutput(notification: {
    id: string
    userId: string
    type: string
    title: string
    message: string
    isRead: boolean
    createdAt: Date
    actorId: string | null
    data: Record<string, unknown> | null
  }): NotificationOutput {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      actorId: notification.actorId ?? undefined,
      data: notification.data ?? undefined,
    }
  }
}
