/**
 * NotificationJob Entity — كيان مهمة التوصيل
 * Immutable domain entity. All methods return NEW instances.
 * No external dependencies — pure TypeScript only.
 */

import { DeliveryStatus, type NotificationChannel } from '../value-objects'

/** Props for creating a new job */
export interface CreateNotificationJobProps {
  notificationId: string
  channel: NotificationChannel
}

/** Props for reconstructing from database */
export interface ReconstructNotificationJobProps {
  id: string
  notificationId: string
  channel: NotificationChannel
  status: DeliveryStatus
  attempts: number
  maxAttempts: number
  lastError: string | null
  scheduledFor: Date
  processedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const DEFAULT_MAX_ATTEMPTS = 5

export class NotificationJob {
  private constructor(
    readonly id: string,
    readonly notificationId: string,
    readonly channel: NotificationChannel,
    readonly status: DeliveryStatus,
    readonly attempts: number,
    readonly maxAttempts: number,
    readonly lastError: string | null,
    readonly scheduledFor: Date,
    readonly processedAt: Date | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  /**
   * Create a new delivery job.
   */
  static create(notificationId: string, channel: NotificationChannel): NotificationJob {
    if (!notificationId) throw new Error('NotificationJob.notificationId is required')

    const now = new Date()
    return new NotificationJob(
      generateId(),
      notificationId,
      channel,
      DeliveryStatus.Pending,
      0,
      DEFAULT_MAX_ATTEMPTS,
      null,
      now,
      null,
      now,
      now,
    )
  }

  /**
   * Reconstruct from database — no validation.
   */
  static reconstruct(props: ReconstructNotificationJobProps): NotificationJob {
    return new NotificationJob(
      props.id,
      props.notificationId,
      props.channel,
      props.status,
      props.attempts,
      props.maxAttempts,
      props.lastError,
      props.scheduledFor,
      props.processedAt,
      props.createdAt,
      props.updatedAt,
    )
  }

  /** Check if this job can be retried */
  canRetry(): boolean {
    return this.attempts < this.maxAttempts && this.status !== DeliveryStatus.DeadLetter
  }

  /** Check if the job is ready to be processed */
  isReadyToProcess(): boolean {
    return (
      (this.status === DeliveryStatus.Pending || this.status === DeliveryStatus.Failed) &&
      this.scheduledFor <= new Date()
    )
  }

  /** Mark as processing — returns NEW instance */
  markAsProcessing(): NotificationJob {
    return new NotificationJob(
      this.id,
      this.notificationId,
      this.channel,
      DeliveryStatus.Processing,
      this.attempts,
      this.maxAttempts,
      this.lastError,
      this.scheduledFor,
      null,
      this.createdAt,
      new Date(),
    )
  }

  /** Mark as sent — returns NEW instance */
  markAsSent(): NotificationJob {
    const now = new Date()
    return new NotificationJob(
      this.id,
      this.notificationId,
      this.channel,
      DeliveryStatus.Sent,
      this.attempts,
      this.maxAttempts,
      null,
      this.scheduledFor,
      now,
      this.createdAt,
      now,
    )
  }

  /** Mark as failed — returns NEW instance */
  markAsFailed(error: string): NotificationJob {
    return new NotificationJob(
      this.id,
      this.notificationId,
      this.channel,
      DeliveryStatus.Failed,
      this.attempts + 1,
      this.maxAttempts,
      error,
      this.scheduledFor,
      null,
      this.createdAt,
      new Date(),
    )
  }

  /** Schedule a retry with delay — returns NEW instance */
  scheduleRetry(delayMs: number): NotificationJob {
    const now = new Date()
    const scheduledFor = new Date(now.getTime() + delayMs)
    return new NotificationJob(
      this.id,
      this.notificationId,
      this.channel,
      DeliveryStatus.Pending,
      this.attempts + 1,
      this.maxAttempts,
      null,
      scheduledFor,
      null,
      this.createdAt,
      now,
    )
  }

  /** Move to dead letter queue — returns NEW instance */
  moveToDeadLetter(error: string): NotificationJob {
    const now = new Date()
    return new NotificationJob(
      this.id,
      this.notificationId,
      this.channel,
      DeliveryStatus.DeadLetter,
      this.attempts,
      this.maxAttempts,
      error,
      this.scheduledFor,
      null,
      this.createdAt,
      now,
    )
  }
}

/** Generate a cuid-like ID */
function generateId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}${random}`
}
