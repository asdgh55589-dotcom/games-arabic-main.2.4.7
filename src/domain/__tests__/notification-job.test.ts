import { NotificationJob } from '../entities/notification-job'
import { NotificationChannel, DeliveryStatus } from '../value-objects'

describe('NotificationJob Entity', () => {
  describe('create', () => {
    it('should create a job with pending status', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)

      expect(job.notificationId).toBe('notif-123')
      expect(job.channel).toBe(NotificationChannel.Email)
      expect(job.status).toBe(DeliveryStatus.Pending)
      expect(job.attempts).toBe(0)
      expect(job.maxAttempts).toBe(5)
      expect(job.lastError).toBeNull()
      expect(job.processedAt).toBeNull()
      expect(job.id).toBeTruthy()
    })

    it('should throw if notificationId is empty', () => {
      expect(() =>
        NotificationJob.create('', NotificationChannel.Email),
      ).toThrow('NotificationJob.notificationId is required')
    })
  })

  describe('reconstruct', () => {
    it('should reconstruct from props', () => {
      const now = new Date()
      const job = NotificationJob.reconstruct({
        id: 'job-1',
        notificationId: 'notif-123',
        channel: NotificationChannel.InApp,
        status: DeliveryStatus.Sent,
        attempts: 2,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: now,
        processedAt: now,
        createdAt: now,
        updatedAt: now,
      })

      expect(job.status).toBe(DeliveryStatus.Sent)
      expect(job.attempts).toBe(2)
    })
  })

  describe('canRetry', () => {
    it('should return true when attempts < maxAttempts', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      expect(job.canRetry()).toBe(true)
    })

    it('should return false when attempts >= maxAttempts', () => {
      const now = new Date()
      const job = NotificationJob.reconstruct({
        id: 'job-1',
        notificationId: 'notif-123',
        channel: NotificationChannel.Email,
        status: DeliveryStatus.Failed,
        attempts: 5,
        maxAttempts: 5,
        lastError: 'error',
        scheduledFor: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      expect(job.canRetry()).toBe(false)
    })

    it('should return false when status is DeadLetter', () => {
      const now = new Date()
      const job = NotificationJob.reconstruct({
        id: 'job-1',
        notificationId: 'notif-123',
        channel: NotificationChannel.Email,
        status: DeliveryStatus.DeadLetter,
        attempts: 3,
        maxAttempts: 5,
        lastError: 'error',
        scheduledFor: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      expect(job.canRetry()).toBe(false)
    })
  })

  describe('isReadyToProcess', () => {
    it('should return true when pending and scheduled time passed', () => {
      const past = new Date(Date.now() - 1000)
      const job = NotificationJob.reconstruct({
        id: 'job-1',
        notificationId: 'notif-123',
        channel: NotificationChannel.Email,
        status: DeliveryStatus.Pending,
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: past,
        processedAt: null,
        createdAt: past,
        updatedAt: past,
      })
      expect(job.isReadyToProcess()).toBe(true)
    })

    it('should return false when scheduled for future', () => {
      const future = new Date(Date.now() + 60000)
      const job = NotificationJob.reconstruct({
        id: 'job-1',
        notificationId: 'notif-123',
        channel: NotificationChannel.Email,
        status: DeliveryStatus.Pending,
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: future,
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      expect(job.isReadyToProcess()).toBe(false)
    })
  })

  describe('markAsProcessing', () => {
    it('should return new instance with Processing status', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      const processing = job.markAsProcessing()

      expect(processing.status).toBe(DeliveryStatus.Processing)
      expect(processing.id).toBe(job.id)
      // Original unchanged
      expect(job.status).toBe(DeliveryStatus.Pending)
    })
  })

  describe('markAsSent', () => {
    it('should return new instance with Sent status', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      const processing = job.markAsProcessing()
      const sent = processing.markAsSent()

      expect(sent.status).toBe(DeliveryStatus.Sent)
      expect(sent.processedAt).toBeInstanceOf(Date)
      expect(sent.lastError).toBeNull()
    })
  })

  describe('markAsFailed', () => {
    it('should return new instance with Failed status and increment attempts', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      const failed = job.markAsFailed('connection timeout')

      expect(failed.status).toBe(DeliveryStatus.Failed)
      expect(failed.attempts).toBe(1)
      expect(failed.lastError).toBe('connection timeout')
    })
  })

  describe('scheduleRetry', () => {
    it('should return new instance scheduled for future', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      const retry = job.scheduleRetry(5000)

      expect(retry.status).toBe(DeliveryStatus.Pending)
      expect(retry.attempts).toBe(1)
      expect(retry.scheduledFor.getTime()).toBeGreaterThan(Date.now())
      expect(retry.lastError).toBeNull()
    })
  })

  describe('moveToDeadLetter', () => {
    it('should return new instance with DeadLetter status', () => {
      const job = NotificationJob.create('notif-123', NotificationChannel.Email)
      const dead = job.moveToDeadLetter('max retries exceeded')

      expect(dead.status).toBe(DeliveryStatus.DeadLetter)
      expect(dead.lastError).toBe('max retries exceeded')
      expect(dead.canRetry()).toBe(false)
    })
  })
})
