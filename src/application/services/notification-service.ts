/**
 * NotificationService — خدمة الإشعارات (المنسق الرئيسي)
 * Orchestrates: preferences → template → deduplication → create → save → events → queue
 * This is the ONLY entry point for sending notifications.
 */

import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationRepository,
  PreferenceRepository,
  TemplateRenderer,
  EventPublisher,
  JobQueue,
  DeduplicationPolicy,
  PreferencePolicy,
  DeliveryPolicy,
  NotificationJob,
  createNotificationCreatedEvent,
} from '@/domain'
import type { SendNotificationInput } from '../dto'

export interface NotificationServiceDependencies {
  notificationRepo: NotificationRepository
  preferenceRepo: PreferenceRepository
  templateRenderer: TemplateRenderer
  eventPublisher: EventPublisher
  jobQueue: JobQueue
  deduplicationPolicy: DeduplicationPolicy
  preferencePolicy: PreferencePolicy
  deliveryPolicy: DeliveryPolicy
}

export interface SendNotificationResult {
  success: boolean
  notificationId?: string
  channelResults: ChannelResult[]
}

export interface ChannelResult {
  channel: NotificationChannel
  success: boolean
  notificationId?: string
  reason?: 'preference_disabled' | 'deduplicated' | 'error'
  deduplicated?: boolean
}

export class NotificationService {
  constructor(private readonly deps: NotificationServiceDependencies) {}

  /**
   * Main entry point for sending notifications.
   * Orchestrates the full notification pipeline for each channel.
   */
  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const channels = input.channels ?? [NotificationChannel.InApp]
    const results: ChannelResult[] = []

    for (const channel of channels) {
      const result = await this.sendToChannel(input, channel)
      results.push(result)
    }

    return {
      success: results.some(r => r.success),
      notificationId: results.find(r => r.notificationId)?.notificationId,
      channelResults: results,
    }
  }

  private async sendToChannel(
    input: SendNotificationInput,
    channel: NotificationChannel,
  ): Promise<ChannelResult> {
    // Step 1: Check preferences
    const canDeliver = await this.deps.preferencePolicy.canDeliver(
      input.userId, input.type, channel,
    )
    if (!canDeliver) {
      return { channel, success: false, reason: 'preference_disabled' }
    }

    // Step 2: Render template first (to get title/message for dedup check)
    const rendered = await this.deps.templateRenderer.render(
      input.type, channel, input.templateVariables ?? {},
    )

    const title = input.title ?? rendered.title
    const message = input.message ?? rendered.body

    // Step 3: Check deduplication (unless skipped)
    if (!input.skipDeduplication) {
      const dedupResult = await this.deps.deduplicationPolicy.check(
        Notification.create({
          userId: input.userId,
          type: input.type,
          title,
          message,
          actorId: input.actorId,
        }),
      )
      if (dedupResult.action === 'skip') {
        return {
          channel,
          success: false,
          reason: 'deduplicated',
          notificationId: dedupResult.existingNotification?.id,
        }
      }
    }

    // Step 4: Create notification entity
    const notification = Notification.create({
      userId: input.userId,
      type: input.type,
      title,
      message,
      actorId: input.actorId,
      data: input.data,
    })

    // Step 5: Save
    const saved = await this.deps.notificationRepo.create(notification)

    // Step 6: Publish domain event
    const event = createNotificationCreatedEvent({
      notificationId: saved.id,
      userId: saved.userId,
      type: saved.type,
      channel,
      actorId: saved.actorId ?? undefined,
    })
    await this.deps.eventPublisher.publish(event)

    // Step 7: Queue job for non-in_app channels
    if (channel !== NotificationChannel.InApp) {
      const job = NotificationJob.create(saved.id, channel)
      await this.deps.jobQueue.enqueue(job)
    }

    return { channel, success: true, notificationId: saved.id }
  }
}
