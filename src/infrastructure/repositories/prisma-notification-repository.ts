/**
 * PrismaNotificationRepository — مستودع الإشعارات via Prisma
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import type { PaginationOptions } from '@/domain'
import { Notification, type NotificationRepository, type NotificationType } from '@/domain'
import type { ReconstructNotificationProps } from '@/domain/entities/notification'

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(notification: Notification): Promise<Notification> {
    const record = await this.db.notification.create({
      data: {
        userId: notification.userId,
        actorId: notification.actorId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data as Prisma.InputJsonValue | undefined,
        isRead: notification.isRead,
        readAt: notification.readAt,
      },
    })
    return Notification.reconstruct(record as unknown as ReconstructNotificationProps)
  }

  async findById(id: string): Promise<Notification | null> {
    const record = await this.db.notification.findUnique({ where: { id } })
    return record ? Notification.reconstruct(record as unknown as ReconstructNotificationProps) : null
  }

  async findByUserId(userId: string, options?: PaginationOptions): Promise<Notification[]> {
    const { page = 1, limit = 20 } = options ?? {}
    const records = await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })
    return records.map((r) => Notification.reconstruct(r as unknown as ReconstructNotificationProps))
  }

  async findUnreadCount(userId: string): Promise<number> {
    return this.db.notification.count({
      where: { userId, isRead: false },
    })
  }

  async markAsRead(id: string): Promise<void> {
    await this.db.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async findRecent(
    userId: string,
    type: NotificationType,
    withinMinutes: number,
  ): Promise<Notification | null> {
    const since = new Date(Date.now() - withinMinutes * 60 * 1000)
    const record = await this.db.notification.findFirst({
      where: {
        userId,
        type,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    })
    return record ? Notification.reconstruct(record as unknown as ReconstructNotificationProps) : null
  }

  async update(
    id: string,
    data: Partial<Pick<Notification, 'title' | 'message' | 'data'>>,
  ): Promise<Notification> {
    const record = await this.db.notification.update({
      where: { id },
      data: data as Prisma.NotificationUpdateInput,
    })
    return Notification.reconstruct(record as unknown as ReconstructNotificationProps)
  }

  async delete(id: string): Promise<void> {
    await this.db.notification.delete({ where: { id } })
  }
}
