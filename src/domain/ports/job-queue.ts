/**
 * JobQueue — منفذ قائمة انتظار المهام
 * Interface only — implementation provided by infrastructure layer.
 */

import { NotificationJob } from '../entities'

export interface JobQueue {
  /** Add a job to the queue */
  enqueue(job: NotificationJob): Promise<void>

  /** Get the next job to process */
  dequeue(): Promise<NotificationJob | null>

  /** Mark a job as processed */
  markAsProcessed(jobId: string): Promise<void>

  /** Move a job to the dead letter queue */
  moveToDeadLetter(jobId: string, error: string): Promise<void>

  /** Get all dead letter jobs for inspection */
  getDeadLetterJobs(): Promise<NotificationJob[]>
}
