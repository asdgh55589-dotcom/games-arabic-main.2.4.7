import { NotificationJob } from '../entities/notification-job'
import { ExponentialBackoffDeliveryPolicy } from '../policies/delivery-policy'
import { DeliveryStatus, NotificationChannel } from '../value-objects'

describe('DeliveryPolicy', () => {
  describe('ExponentialBackoffDeliveryPolicy', () => {
    const policy = new ExponentialBackoffDeliveryPolicy(1000, 300_000, 1000)

    describe('shouldRetry', () => {
      it('should return true for retryable jobs', () => {
        const job = NotificationJob.create('notif-1', NotificationChannel.Email)
        expect(policy.shouldRetry(job)).toBe(true)
      })

      it('should return false for dead letter jobs', () => {
        const now = new Date()
        const job = NotificationJob.reconstruct({
          id: 'job-1',
          notificationId: 'notif-1',
          channel: NotificationChannel.Email,
          status: DeliveryStatus.DeadLetter,
          attempts: 5,
          maxAttempts: 5,
          lastError: 'error',
          scheduledFor: now,
          processedAt: null,
          createdAt: now,
          updatedAt: now,
        })
        expect(policy.shouldRetry(job)).toBe(false)
      })
    })

    describe('calculateRetryDelay', () => {
      it('should calculate exponential backoff', () => {
        const delay0 = policy.calculateRetryDelay(0)
        const delay1 = policy.calculateRetryDelay(1)
        const delay2 = policy.calculateRetryDelay(2)

        // Base delays: 1s, 2s, 4s (plus jitter)
        expect(delay0).toBeGreaterThanOrEqual(1000)
        expect(delay0).toBeLessThan(2000)
        expect(delay1).toBeGreaterThanOrEqual(2000)
        expect(delay1).toBeLessThan(4000)
        expect(delay2).toBeGreaterThanOrEqual(4000)
        expect(delay2).toBeLessThan(8000)
      })

      it('should cap at maxDelayMs', () => {
        const delay = policy.calculateRetryDelay(20)
        expect(delay).toBeLessThanOrEqual(300_000)
      })
    })

    describe('isCircuitOpen', () => {
      it('should return false (not implemented yet)', () => {
        expect(policy.isCircuitOpen('resend')).toBe(false)
      })
    })
  })
})
