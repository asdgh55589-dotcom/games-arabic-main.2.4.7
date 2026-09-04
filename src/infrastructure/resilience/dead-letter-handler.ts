/**
 * DeadLetterHandler — معالج الرسائل الميتة
 * Tracks jobs that failed all retry attempts.
 */

import type { NotificationJob } from '@/domain'
import { notificationLogger } from '../observability/logger'

export interface DeadLetterEntry {
  job: NotificationJob
  error: string
  failedAt: Date
  originalChannel: string
}

export class DeadLetterHandler {
  private deadLetters: DeadLetterEntry[] = []

  add(job: NotificationJob, error: string): void {
    this.deadLetters.push({
      job,
      error,
      failedAt: new Date(),
      originalChannel: job.channel,
    })

    notificationLogger.error('Job moved to dead letter queue', {
      notificationId: job.notificationId,
      channel: job.channel,
      action: 'dead_letter.add',
      error,
      jobId: job.id,
    })
  }

  getAll(): DeadLetterEntry[] {
    return [...this.deadLetters]
  }

  getCount(): number {
    return this.deadLetters.length
  }

  clear(): void {
    this.deadLetters = []
  }

  retry(jobId: string): DeadLetterEntry | null {
    const index = this.deadLetters.findIndex((e) => e.job.id === jobId)
    if (index === -1) return null
    const entry = this.deadLetters[index]
    this.deadLetters.splice(index, 1)
    return entry
  }
}
