/**
 * NotificationRepository — منفذ مستودع الإشعارات
 * Interface only — implementation provided by infrastructure layer.
 */

import type { Notification } from '../entities'
import type { NotificationType } from '../value-objects'

export interface PaginationOptions {
  page: number
  limit: number
  cursor?: string
}

export interface NotificationRepository {
  /** Create a new notification */
  create(notification: Notification): Promise<Notification>

  /** Find notification by ID */
  findById(id: string): Promise<Notification | null>

  /** Find notifications for a user with pagination */
  findByUserId(userId: string, options?: PaginationOptions): Promise<Notification[]>

  /** Count unread notifications for a user */
  findUnreadCount(userId: string): Promise<number>

  /** Mark a single notification as read */
  markAsRead(id: string): Promise<void>

  /** Mark all notifications for a user as read */
  markAllAsRead(userId: string): Promise<void>

  /**
   * Find a recent notification of the same type for deduplication.
   * Used to check if a similar notification was created within the time window.
   */
  findRecent(
    userId: string,
    type: NotificationType,
    withinMinutes: number,
  ): Promise<Notification | null>

  /** Update a notification */
  update(
    id: string,
    data: Partial<Pick<Notification, 'title' | 'message' | 'data'>>,
  ): Promise<Notification>

  /** Delete a notification */
  delete(id: string): Promise<void>
}
