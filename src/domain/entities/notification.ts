/**
 * Notification Entity — كيان الإشعار
 * Immutable domain entity. All methods return NEW instances.
 * No external dependencies — pure TypeScript only.
 */

import type { NotificationType } from '../value-objects'

/** Props for creating a new Notification */
export interface CreateNotificationProps {
  userId: string
  type: NotificationType
  title: string
  message: string
  actorId?: string
  data?: Record<string, unknown>
}

/** Props for reconstructing from database */
export interface ReconstructNotificationProps {
  id: string
  userId: string
  actorId: string | null
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown> | null
  isRead: boolean
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export class Notification {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly actorId: string | null,
    readonly type: NotificationType,
    readonly title: string,
    readonly message: string,
    readonly data: Record<string, unknown> | null,
    readonly isRead: boolean,
    readonly readAt: Date | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /**
   * Create a new Notification with validation and defaults.
   * @throws Error if required fields are missing or empty
   */
  static create(props: CreateNotificationProps): Notification {
    if (!props.userId) throw new Error('Notification.userId is required')
    if (!props.type) throw new Error('Notification.type is required')
    if (!props.title?.trim()) throw new Error('Notification.title is required')
    if (!props.message?.trim()) throw new Error('Notification.message is required')

    const now = new Date()
    return new Notification(
      generateId(),
      props.userId,
      props.actorId ?? null,
      props.type,
      props.title.trim(),
      props.message.trim(),
      props.data ?? null,
      false,
      null,
      now,
      now,
    )
  }

  /**
   * Reconstruct from database — no validation, no defaults.
   * Use when loading existing records.
   */
  static reconstruct(props: ReconstructNotificationProps): Notification {
    return new Notification(
      props.id,
      props.userId,
      props.actorId,
      props.type,
      props.title,
      props.message,
      props.data,
      props.isRead,
      props.readAt,
      props.createdAt,
      props.updatedAt,
    )
  }

  /** Mark as read — returns a NEW instance */
  markAsRead(): Notification {
    const now = new Date()
    return new Notification(
      this.id,
      this.userId,
      this.actorId,
      this.type,
      this.title,
      this.message,
      this.data,
      true,
      now,
      this.createdAt,
      now,
    )
  }

  /** Update message — returns a NEW instance */
  updateMessage(message: string): Notification {
    if (!message?.trim()) throw new Error('Notification.message cannot be empty')

    return new Notification(
      this.id,
      this.userId,
      this.actorId,
      this.type,
      this.title,
      message.trim(),
      this.data,
      this.isRead,
      this.readAt,
      this.createdAt,
      new Date(),
    )
  }

  /** Check if this notification belongs to the given user */
  belongsTo(userId: string): boolean {
    return this.userId === userId
  }

  /** Check if this notification was triggered by the given user */
  isTriggeredBy(actorId: string): boolean {
    return this.actorId === actorId
  }
}

/** Generate a cuid-like ID (simplified for domain layer) */
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}${random}`
}
