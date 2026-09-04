import { NotificationService } from '../services/notification-service'
import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationRepository, TemplateRenderer, EventPublisher, JobQueue } from '@/domain'

describe('NotificationService', () => {
  let service: NotificationService
  let mockNotificationRepo: NotificationRepository
  let mockTemplateRenderer: TemplateRenderer
  let mockEventPublisher: EventPublisher
  let mockJobQueue: JobQueue

  beforeEach(() => {
    mockNotificationRepo = {
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

    mockTemplateRenderer = {
      render: jest.fn().mockResolvedValue({
        title: 'عنوان اختبار',
        body: 'رسالة اختبار',
      }),
    }

    mockEventPublisher = {
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    }

    mockJobQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      markAsProcessed: jest.fn(),
      moveToDeadLetter: jest.fn(),
      getDeadLetterJobs: jest.fn(),
    }

    service = new NotificationService({
      notificationRepo: mockNotificationRepo,
      preferenceRepo: {} as any,
      templateRenderer: mockTemplateRenderer,
      eventPublisher: mockEventPublisher,
      jobQueue: mockJobQueue,
      deduplicationPolicy: {
        check: jest.fn().mockResolvedValue({ action: 'create' }),
      } as any,
      preferencePolicy: {
        canDeliver: jest.fn().mockResolvedValue(true),
        shouldQueueForLater: jest.fn().mockResolvedValue(false),
      } as any,
      deliveryPolicy: {} as any,
    })
  })

  describe('send', () => {
    it('should create notification and publish event for in-app channel', async () => {
      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        title: 'Test',
        message: 'Test message',
      })

      expect(result.success).toBe(true)
      expect(result.notificationId).toBeTruthy()
      expect(mockNotificationRepo.create).toHaveBeenCalled()
      expect(mockEventPublisher.publish).toHaveBeenCalled()
      expect(mockJobQueue.enqueue).not.toHaveBeenCalled()
    })

    it('should queue job for email channel', async () => {
      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.Email],
      })

      expect(result.success).toBe(true)
      expect(mockJobQueue.enqueue).toHaveBeenCalled()
    })

    it('should skip if preference disabled', async () => {
      ;(service as any).deps.preferencePolicy.canDeliver = jest.fn().mockResolvedValue(false)

      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
      })

      expect(result.success).toBe(false)
      expect(result.channelResults[0].reason).toBe('preference_disabled')
      expect(mockNotificationRepo.create).not.toHaveBeenCalled()
    })

    it('should skip if deduplicated', async () => {
      ;(service as any).deps.deduplicationPolicy.check = jest.fn().mockResolvedValue({
        action: 'skip',
        reason: 'Duplicate',
      })

      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
      })

      expect(result.success).toBe(false)
      expect(result.channelResults[0].reason).toBe('deduplicated')
    })

    it('should skip deduplication when skipDeduplication=true', async () => {
      await service.send({
        userId: 'user-1',
        type: NotificationType.AdminAction,
        skipDeduplication: true,
      })

      expect((service as any).deps.deduplicationPolicy.check).not.toHaveBeenCalled()
    })

    it('should use template when title/message not provided', async () => {
      await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
      })

      expect(mockTemplateRenderer.render).toHaveBeenCalled()
      expect(mockNotificationRepo.create).toHaveBeenCalled()
    })
  })

  describe('send to multiple channels', () => {
    it('should send to both in-app and email', async () => {
      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      })

      expect(result.channelResults).toHaveLength(2)
      expect(result.channelResults[0].channel).toBe(NotificationChannel.InApp)
      expect(result.channelResults[1].channel).toBe(NotificationChannel.Email)
      expect(mockJobQueue.enqueue).toHaveBeenCalledTimes(1)
    })
  })
})
