/**
 * PrismaJobQueue — قائمة انتظار المهام عبر Prisma
 * Persistent job queue backed by the notification_jobs table.
 * Uses atomic updateMany to prevent double-processing in concurrent workers.
 */

import type { PrismaClient } from '@prisma/client'
import { DeliveryStatus, type JobQueue, type NotificationChannel, NotificationJob } from '@/domain'

export class PrismaJobQueue implements JobQueue {
  constructor(private readonly db: PrismaClient) {}

  async enqueue(job: NotificationJob): Promise<void> {
    await this.db.notificationJob.upsert({
      where: { id: job.id },
      create: {
        id: job.id,
        notificationId: job.notificationId,
        channel: job.channel,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        lastError: job.lastError,
        scheduledFor: job.scheduledFor,
      },
      update: {
        status: job.status,
        attempts: job.attempts,
        lastError: job.lastError,
        scheduledFor: job.scheduledFor,
        processedAt: job.processedAt,
      },
    })
  }

  async dequeue(): Promise<NotificationJob | null> {
    const record = await this.db.notificationJob.findFirst({
      where: {
        status: 'pending',
        scheduledFor: { lte: new Date() },
      },
      orderBy: { scheduledFor: 'asc' },
    })

    if (!record) return null

    // Atomically mark as processing to prevent double-processing
    const updated = await this.db.notificationJob.updateMany({
      where: { id: record.id, status: 'pending' },
      data: { status: 'processing' },
    })

    if (updated.count === 0) return null // Another worker got it

    return NotificationJob.reconstruct({
      id: record.id,
      notificationId: record.notificationId,
      channel: record.channel as NotificationChannel,
      status: DeliveryStatus.Processing,
      attempts: record.attempts,
      maxAttempts: record.maxAttempts,
      lastError: record.lastError,
      scheduledFor: record.scheduledFor,
      processedAt: record.processedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
  }

  async markAsProcessed(jobId: string): Promise<void> {
    await this.db.notificationJob.update({
      where: { id: jobId },
      data: { status: 'sent', processedAt: new Date() },
    })
  }

  async moveToDeadLetter(jobId: string, error: string): Promise<void> {
    await this.db.notificationJob.update({
      where: { id: jobId },
      data: { status: 'dead_letter', lastError: error },
    })
  }

  async getDeadLetterJobs(): Promise<NotificationJob[]> {
    const records = await this.db.notificationJob.findMany({
      where: { status: 'dead_letter' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return records.map((r) =>
      NotificationJob.reconstruct({
        id: r.id,
        notificationId: r.notificationId,
        channel: r.channel as NotificationChannel,
        status: DeliveryStatus.DeadLetter,
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        lastError: r.lastError,
        scheduledFor: r.scheduledFor,
        processedAt: r.processedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    )
  }
}
