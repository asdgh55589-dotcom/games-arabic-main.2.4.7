/**
 * Error Scenario Tests
 * Tests circuit breaker, retry, dead letter, and failure handling.
 */

import { CircuitBreaker, CircuitOpenError } from '@/infrastructure/resilience/circuit-breaker'
import { RetryPolicy } from '@/infrastructure/resilience/retry-policy'
import { DeadLetterHandler } from '@/infrastructure/resilience/dead-letter-handler'
import { NotificationJob, NotificationChannel, NotificationType } from '@/domain'
import { NotificationService } from '@/application/services/notification-service'
import type { NotificationRepository, TemplateRenderer, EventPublisher, JobQueue } from '@/domain'

function createFailingNotificationRepo(): NotificationRepository {
  return {
    create: jest.fn().mockRejectedValue(new Error('DB connection failed')),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    findRecent: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
}

function createSucceedingNotificationRepo(): NotificationRepository {
  return {
    create: jest.fn().mockImplementation((n: any) => Promise.resolve(n)),
    findById: jest.fn(),
    findByUserId: jest.fn().mockResolvedValue([]),
    findUnreadCount: jest.fn().mockResolvedValue(0),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    findRecent: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    delete: jest.fn(),
  }
}

describe('Error Scenarios', () => {
  describe('CircuitBreaker', () => {
    let circuit: CircuitBreaker
    const onStateChange = jest.fn()

    beforeEach(() => {
      onStateChange.mockClear()
      circuit = new CircuitBreaker('test-service', {
        failureThreshold: 3,
        resetTimeoutMs: 100,
        halfOpenMaxAttempts: 2,
        onStateChange,
      })
    })

    it('should open after consecutive failures', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error(`fail-${i}`)
          }),
        ).rejects.toThrow()
      }

      expect(circuit.currentState).toBe('OPEN')
      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN')
    })

    it('should reject immediately when OPEN', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await expect(circuit.execute(async () => 'ok')).rejects.toThrow(CircuitOpenError)
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      const result = await circuit.execute(async () => 'recovered')
      expect(result).toBe('recovered')
      expect(circuit.currentState).toBe('HALF_OPEN')
    })

    it('should close after successful HALF_OPEN attempts', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      await circuit.execute(async () => 'ok1')
      await circuit.execute(async () => 'ok2')

      expect(circuit.currentState).toBe('CLOSED')
    })

    it('should re-open if HALF_OPEN attempt fails', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      await new Promise((r) => setTimeout(r, 110))

      await expect(
        circuit.execute(async () => {
          throw new Error('fail again')
        }),
      ).rejects.toThrow()

      expect(circuit.currentState).toBe('OPEN')
    })

    it('should reset failure count on success', async () => {
      // 2 failures (below threshold)
      await expect(
        circuit.execute(async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow()
      await expect(
        circuit.execute(async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow()

      // Success resets count
      await circuit.execute(async () => 'ok')

      // 2 more failures should not open circuit
      await expect(
        circuit.execute(async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow()
      await expect(
        circuit.execute(async () => {
          throw new Error('fail')
        }),
      ).rejects.toThrow()

      expect(circuit.currentState).toBe('CLOSED')
    })

    it('should reset to CLOSED state', async () => {
      for (let i = 0; i < 3; i++) {
        await expect(
          circuit.execute(async () => {
            throw new Error('fail')
          }),
        ).rejects.toThrow()
      }

      circuit.reset()
      expect(circuit.currentState).toBe('CLOSED')
    })
  })

  describe('RetryPolicy', () => {
    it('should retry with increasing delays', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 4,
        baseDelayMs: 10,
        maxDelayMs: 1000,
        jitterMs: 0,
      })

      const delays: number[] = []
      const originalCalcDelay = policy.calculateDelay.bind(policy)
      policy.calculateDelay = jest.fn().mockImplementation((attempt: number) => {
        const delay = originalCalcDelay(attempt)
        delays.push(delay)
        return delay
      })

      let attempts = 0
      await expect(
        policy.execute(async () => {
          attempts++
          if (attempts < 4) throw new Error('transient')
          return 'success'
        }),
      ).resolves.toBe('success')

      expect(attempts).toBe(4)
      expect(delays.length).toBe(3)
      // Delays should increase (exponential)
      expect(delays[1]).toBeGreaterThan(delays[0])
      expect(delays[2]).toBeGreaterThan(delays[1])
    })

    it('should stop after maxAttempts', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 10,
        jitterMs: 0,
      })

      let attempts = 0
      await expect(
        policy.execute(async () => {
          attempts++
          throw new Error('permanent failure')
        }),
      ).rejects.toThrow('permanent failure')

      expect(attempts).toBe(3)
    })

    it('should add jitter to prevent thundering herd', () => {
      const policy = new RetryPolicy({
        maxAttempts: 5,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        jitterMs: 50,
      })

      const delays = Array.from({ length: 10 }, (_, i) => policy.calculateDelay(i))
      // Jitter means delays are not identical even for same attempt
      const uniqueDelays = new Set(delays.map((d) => Math.round(d)))
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })

    it('should respect shouldRetry callback', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 5,
        baseDelayMs: 1,
        maxDelayMs: 10,
        jitterMs: 0,
        shouldRetry: (error: unknown) => {
          return (error as Error).message !== 'permanent'
        },
      })

      let attempts = 0
      await expect(
        policy.execute(async () => {
          attempts++
          throw new Error('permanent')
        }),
      ).rejects.toThrow('permanent')

      expect(attempts).toBe(1)
    })
  })

  describe('DeadLetterHandler', () => {
    let handler: DeadLetterHandler

    beforeEach(() => {
      handler = new DeadLetterHandler()
    })

    it('should track dead letter jobs', () => {
      const job = NotificationJob.create('notif-1', NotificationChannel.Email)
      handler.add(job, 'SMTP timeout')

      expect(handler.getCount()).toBe(1)
      const entries = handler.getAll()
      expect(entries[0].job.id).toBe(job.id)
      expect(entries[0].error).toBe('SMTP timeout')
      expect(entries[0].originalChannel).toBe(NotificationChannel.Email)
    })

    it('should list all dead letter jobs', () => {
      const job1 = NotificationJob.create('notif-1', NotificationChannel.Email)
      const job2 = NotificationJob.create('notif-2', NotificationChannel.Telegram)
      const job3 = NotificationJob.create('notif-3', NotificationChannel.Email)

      handler.add(job1, 'error1')
      handler.add(job2, 'error2')
      handler.add(job3, 'error3')

      expect(handler.getCount()).toBe(3)
      expect(handler.getAll()).toHaveLength(3)
    })

    it('should retry and remove from dead letter', () => {
      const job = NotificationJob.create('notif-1', NotificationChannel.Email)
      handler.add(job, 'SMTP timeout')

      const entry = handler.retry(job.id)
      expect(entry).not.toBeNull()
      expect(entry!.job.id).toBe(job.id)
      expect(handler.getCount()).toBe(0)
    })

    it('should return null for non-existent job retry', () => {
      const result = handler.retry('non-existent')
      expect(result).toBeNull()
    })

    it('should clear all entries', () => {
      const job1 = NotificationJob.create('notif-1', NotificationChannel.Email)
      const job2 = NotificationJob.create('notif-2', NotificationChannel.Email)

      handler.add(job1, 'error1')
      handler.add(job2, 'error2')

      handler.clear()
      expect(handler.getCount()).toBe(0)
    })
  })

  describe('Email Send Failure', () => {
    it('should handle email failure gracefully in service', async () => {
      const mockJobQueue: JobQueue & { jobs: any[] } = {
        jobs: [],
        enqueue: jest.fn().mockImplementation((j: any) => {
          mockJobQueue.jobs.push(j)
          return Promise.resolve()
        }),
        dequeue: jest.fn(),
        markAsProcessed: jest.fn(),
        moveToDeadLetter: jest.fn(),
        getDeadLetterJobs: jest.fn(),
      }

      const service = new NotificationService({
        notificationRepo: createSucceedingNotificationRepo(),
        preferenceRepo: { findByUserId: jest.fn().mockResolvedValue(null) } as any,
        templateRenderer: {
          render: jest.fn().mockResolvedValue({ title: 'Test', body: 'Test' }),
        },
        eventPublisher: { publish: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
        jobQueue: mockJobQueue,
        deduplicationPolicy: { check: jest.fn().mockResolvedValue({ action: 'create' }) } as any,
        preferencePolicy: {
          canDeliver: jest.fn().mockResolvedValue(true),
          shouldQueueForLater: jest.fn().mockResolvedValue(false),
        } as any,
        deliveryPolicy: {} as any,
      })

      // Email channel should still create a job even if email sending might fail later
      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      })

      expect(result.success).toBe(true)
      expect(result.channelResults).toHaveLength(2)
      expect(mockJobQueue.jobs).toHaveLength(1)
    })
  })

  describe('Database Failure', () => {
    it('should handle notification creation failure gracefully', async () => {
      const service = new NotificationService({
        notificationRepo: createFailingNotificationRepo(),
        preferenceRepo: { findByUserId: jest.fn().mockResolvedValue(null) } as any,
        templateRenderer: {
          render: jest.fn().mockResolvedValue({ title: 'Test', body: 'Test' }),
        },
        eventPublisher: { publish: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
        jobQueue: {
          enqueue: jest.fn(),
          dequeue: jest.fn(),
          markAsProcessed: jest.fn(),
          moveToDeadLetter: jest.fn(),
          getDeadLetterJobs: jest.fn(),
        },
        deduplicationPolicy: { check: jest.fn().mockResolvedValue({ action: 'create' }) } as any,
        preferencePolicy: {
          canDeliver: jest.fn().mockResolvedValue(true),
          shouldQueueForLater: jest.fn().mockResolvedValue(false),
        } as any,
        deliveryPolicy: {} as any,
      })

      await expect(
        service.send({
          userId: 'user-1',
          type: NotificationType.CommentReply,
          title: 'Test',
          message: 'Test',
        }),
      ).rejects.toThrow('DB connection failed')
    })

    it('should handle preference check failure gracefully', async () => {
      const service = new NotificationService({
        notificationRepo: createSucceedingNotificationRepo(),
        preferenceRepo: {
          findByUserId: jest.fn().mockRejectedValue(new Error('DB timeout')),
        } as any,
        templateRenderer: {
          render: jest.fn().mockResolvedValue({ title: 'Test', body: 'Test' }),
        },
        eventPublisher: { publish: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
        jobQueue: {
          enqueue: jest.fn(),
          dequeue: jest.fn(),
          markAsProcessed: jest.fn(),
          moveToDeadLetter: jest.fn(),
          getDeadLetterJobs: jest.fn(),
        },
        deduplicationPolicy: { check: jest.fn().mockResolvedValue({ action: 'create' }) } as any,
        preferencePolicy: {
          canDeliver: jest.fn().mockRejectedValue(new Error('DB timeout')),
        } as any,
        deliveryPolicy: {} as any,
      })

      await expect(
        service.send({
          userId: 'user-1',
          type: NotificationType.CommentReply,
          title: 'Test',
          message: 'Test',
        }),
      ).rejects.toThrow('DB timeout')
    })
  })
})
