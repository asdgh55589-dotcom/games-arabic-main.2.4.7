/**
 * @deprecated Use PrismaJobQueue for production. InMemoryJobQueue is for testing only.
 * InMemoryJobQueue — قائمة انتظار المهام في الذاكرة
 */

import type { JobQueue, NotificationJob } from '@/domain'

export class InMemoryJobQueue implements JobQueue {
  private queue: NotificationJob[] = []

  async enqueue(job: NotificationJob): Promise<void> {
    this.queue.push(job)
  }

  async dequeue(): Promise<NotificationJob | null> {
    const index = this.queue.findIndex((j) => j.isReadyToProcess())
    if (index === -1) return null
    return this.queue.splice(index, 1)[0]
  }

  async markAsProcessed(jobId: string): Promise<void> {
    this.queue = this.queue.filter((j) => j.id !== jobId)
  }

  async moveToDeadLetter(jobId: string, _error: string): Promise<void> {
    this.queue = this.queue.filter((j) => j.id !== jobId)
  }

  async getDeadLetterJobs(): Promise<NotificationJob[]> {
    return this.queue.filter((j) => j.status === 'dead_letter')
  }
}
