/**
 * NotificationOutput — مخرجات الإشعار
 * DTOs for API responses and queries.
 */

export interface NotificationOutput {
  id: string
  userId: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: Date
  actorId?: string
  data?: Record<string, unknown>
}

export interface PaginatedNotificationOutput {
  notifications: NotificationOutput[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  unreadCount: number
}
