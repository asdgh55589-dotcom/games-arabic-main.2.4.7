/**
 * ProcessNotificationJobsCommand — أمر معالجة مهام الإشعارات
 * Processes queued jobs for email/telegram delivery with retry logic.
 */

import type {
  DeliveryPolicy,
  EmailSender,
  JobQueue,
  NotificationJob,
  NotificationRepository,
} from '@/domain'

export interface ProcessResult {
  processed: number
  failed: number
  retried: number
  total: number
}

export class ProcessNotificationJobsCommand {
  constructor(
    private readonly jobQueue: JobQueue,
    private readonly emailSender: EmailSender,
    private readonly notificationRepo: NotificationRepository,
    private readonly deliveryPolicy: DeliveryPolicy,
  ) {}

  async execute(batchSize: number = 50): Promise<ProcessResult> {
    let processed = 0
    let failed = 0
    let retried = 0

    for (let i = 0; i < batchSize; i++) {
      const job = await this.jobQueue.dequeue()
      if (!job) break

      const processingJob = job.markAsProcessing()

      try {
        const notification = await this.notificationRepo.findById(job.notificationId)
        if (!notification) {
          await this.jobQueue.markAsProcessed(job.id)
          continue
        }

        // Check circuit breaker
        if (this.deliveryPolicy.isCircuitOpen('email')) {
          const retryJob = job.scheduleRetry(this.deliveryPolicy.calculateRetryDelay(job.attempts))
          await this.jobQueue.enqueue(retryJob)
          retried++
          continue
        }

        // Send email
        const result = await this.emailSender.send(
          notification.userId,
          notification.title,
          notification.message,
        )

        if (result.success) {
          const sentJob = processingJob.markAsSent()
          await this.jobQueue.markAsProcessed(sentJob.id)
          processed++
        } else {
          throw new Error(result.error ?? 'Email send failed')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        if (job.canRetry()) {
          const delay = this.deliveryPolicy.calculateRetryDelay(job.attempts)
          const retryJob = processingJob.scheduleRetry(delay)
          await this.jobQueue.enqueue(retryJob)
          retried++
        } else {
          await this.jobQueue.moveToDeadLetter(job.id, errorMessage)
          failed++
        }
      }
    }

    return { processed, failed, retried, total: processed + failed + retried }
  }
}
