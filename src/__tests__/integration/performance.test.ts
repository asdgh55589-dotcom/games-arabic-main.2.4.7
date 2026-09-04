/**
 * Performance Tests
 * Tests concurrent operations, caching, and template rendering.
 */

import { NotificationService } from '@/application/services/notification-service'
import type { EventPublisher, JobQueue, NotificationRepository, TemplateRenderer } from '@/domain'
import { NotificationChannel, NotificationType } from '@/domain'

function createPerfMockNotificationRepo(): NotificationRepository {
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

function createPerfMockTemplateRenderer(): TemplateRenderer {
  return {
    render: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ title: 'اختبار', body: 'رسالة اختبار' })),
  }
}

function createPerfMockEventPublisher(): EventPublisher {
  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  }
}

function createPerfMockJobQueue(): JobQueue {
  return {
    enqueue: jest.fn().mockResolvedValue(undefined),
    dequeue: jest.fn(),
    markAsProcessed: jest.fn(),
    moveToDeadLetter: jest.fn(),
    getDeadLetterJobs: jest.fn(),
  }
}

function createPerfService() {
  return new NotificationService({
    notificationRepo: createPerfMockNotificationRepo(),
    preferenceRepo: { findByUserId: jest.fn().mockResolvedValue(null) } as any,
    templateRenderer: createPerfMockTemplateRenderer(),
    eventPublisher: createPerfMockEventPublisher(),
    jobQueue: createPerfMockJobQueue(),
    deduplicationPolicy: { check: jest.fn().mockResolvedValue({ action: 'create' }) } as any,
    preferencePolicy: {
      canDeliver: jest.fn().mockResolvedValue(true),
      shouldQueueForLater: jest.fn().mockResolvedValue(false),
    } as any,
    deliveryPolicy: {} as any,
  })
}

describe('Performance', () => {
  it('should handle 100 concurrent notifications without error', async () => {
    const service = createPerfService()

    const promises = Array.from({ length: 100 }, (_, i) =>
      service.send({
        userId: `user-${i}`,
        type: NotificationType.CommentReply,
        title: `إشعار ${i}`,
        message: `رسالة ${i}`,
      }),
    )

    const results = await Promise.all(promises)

    expect(results).toHaveLength(100)
    results.forEach((result) => {
      expect(result.success).toBe(true)
      expect(result.notificationId).toBeTruthy()
    })
  })

  it('should handle 50 concurrent multi-channel notifications', async () => {
    const service = createPerfService()

    const promises = Array.from({ length: 50 }, (_, i) =>
      service.send({
        userId: `user-${i}`,
        type: NotificationType.TierUpgrade,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      }),
    )

    const results = await Promise.all(promises)

    expect(results).toHaveLength(50)
    results.forEach((result) => {
      expect(result.success).toBe(true)
      expect(result.channelResults).toHaveLength(2)
    })
  })

  it('should handle rapid sequential notifications', async () => {
    const service = createPerfService()

    const start = Date.now()
    for (let i = 0; i < 200; i++) {
      await service.send({
        userId: `user-${i % 10}`,
        type: NotificationType.CommentReply,
        title: `إشعار ${i}`,
        message: `رسالة ${i}`,
      })
    }
    const elapsed = Date.now() - start

    // 200 notifications should complete in reasonable time (< 5 seconds)
    expect(elapsed).toBeLessThan(5000)
  })

  it('should render same template type efficiently', async () => {
    const templateRenderer = createPerfMockTemplateRenderer()
    const service = new NotificationService({
      notificationRepo: createPerfMockNotificationRepo(),
      preferenceRepo: { findByUserId: jest.fn().mockResolvedValue(null) } as any,
      templateRenderer,
      eventPublisher: createPerfMockEventPublisher(),
      jobQueue: createPerfMockJobQueue(),
      deduplicationPolicy: { check: jest.fn().mockResolvedValue({ action: 'create' }) } as any,
      preferencePolicy: {
        canDeliver: jest.fn().mockResolvedValue(true),
        shouldQueueForLater: jest.fn().mockResolvedValue(false),
      } as any,
      deliveryPolicy: {} as any,
    })

    const start = Date.now()
    for (let i = 0; i < 100; i++) {
      await service.send({
        userId: `user-${i}`,
        type: NotificationType.CommentReply,
        title: `إشعار ${i}`,
        message: `رسالة ${i}`,
      })
    }
    const elapsed = Date.now() - start

    // 100 template renders should complete quickly
    expect(elapsed).toBeLessThan(3000)
    expect(templateRenderer.render).toHaveBeenCalledTimes(100)
  })

  it('should handle mixed notification types concurrently', async () => {
    const service = createPerfService()

    const types = [
      NotificationType.CommentReply,
      NotificationType.Like,
      NotificationType.Follow,
      NotificationType.ModPublished,
      NotificationType.TierUpgrade,
    ]

    const promises = Array.from({ length: 50 }, (_, i) =>
      service.send({
        userId: `user-${i}`,
        type: types[i % types.length],
        title: `إشعار ${i}`,
        message: `رسالة ${i}`,
      }),
    )

    const results = await Promise.all(promises)
    expect(results).toHaveLength(50)
    results.forEach((r) => expect(r.success).toBe(true))
  })
})
