/**
 * Integration Tests — Full Notification Flows
 * Tests complete flows from trigger to delivery using mocked repositories.
 */

import { NotificationService } from '@/application/services/notification-service'
import { SendCommentReplyNotification } from '@/application/use-cases/social/send-comment-reply'
import { SendTopLevelCommentNotification } from '@/application/use-cases/social/send-top-level-comment'
import { SendLikeNotification } from '@/application/use-cases/social/send-like'
import { SendFollowNotification } from '@/application/use-cases/social/send-follow'
import { SendEndorseMilestoneNotification } from '@/application/use-cases/social/send-endorse-milestone'
import { SendModPublishedNotification } from '@/application/use-cases/mods/send-mod-published'
import { SendTierUpgradeNotification } from '@/application/use-cases/tiers-roles/send-tier-upgrade'
import { SendTierRevokedNotification } from '@/application/use-cases/tiers-roles/send-tier-revoked'
import { SendReportConfirmedNotification } from '@/application/use-cases/reports/send-report-confirmed'
import { SendAutoWarningNotification } from '@/application/use-cases/reports/send-auto-warning'
import { SendAutoBanNotification } from '@/application/use-cases/reports/send-auto-ban'
import { SendAdminAlertNotification } from '@/application/use-cases/admin/send-admin-alert'
import { SendSystemAnnouncementNotification } from '@/application/use-cases/admin/send-system-announcement'
import { NotificationType, NotificationChannel } from '@/domain'
import type {
  NotificationRepository,
  PreferenceRepository,
  TemplateRenderer,
  EventPublisher,
  JobQueue,
} from '@/domain'

interface MockServiceRefs {
  service: NotificationService
  notificationRepo: NotificationRepository & { created: any[] }
  eventPublisher: EventPublisher & { events: any[] }
  jobQueue: JobQueue & { jobs: any[] }
  preferencePolicy: { canDeliver: jest.Mock; shouldQueueForLater: jest.Mock }
  deduplicationPolicy: { check: jest.Mock }
}

function createService(overrides?: { preferenceRepo?: PreferenceRepository }): MockServiceRefs {
  const created: any[] = []
  const notificationRepo: NotificationRepository & { created: any[] } = {
    created,
    create: jest.fn().mockImplementation((n: any) => {
      created.push(n)
      return Promise.resolve(n)
    }),
    findById: jest.fn(),
    findByUserId: jest.fn().mockResolvedValue([]),
    findUnreadCount: jest.fn().mockResolvedValue(0),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    findRecent: jest.fn().mockResolvedValue(null),
    update: jest.fn(),
    delete: jest.fn(),
  }

  const events: any[] = []
  const eventPublisher: EventPublisher & { events: any[] } = {
    events,
    publish: jest.fn().mockImplementation((e: any) => {
      events.push(e)
      return Promise.resolve()
    }),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  }

  const jobs: any[] = []
  const jobQueue: JobQueue & { jobs: any[] } = {
    jobs,
    enqueue: jest.fn().mockImplementation((j: any) => {
      jobs.push(j)
      return Promise.resolve()
    }),
    dequeue: jest.fn(),
    markAsProcessed: jest.fn(),
    moveToDeadLetter: jest.fn(),
    getDeadLetterJobs: jest.fn(),
  }

  const preferencePolicy = {
    canDeliver: jest.fn().mockResolvedValue(true),
    shouldQueueForLater: jest.fn().mockResolvedValue(false),
  }

  const deduplicationPolicy = {
    check: jest.fn().mockResolvedValue({ action: 'create' }),
  }

  const service = new NotificationService({
    notificationRepo,
    preferenceRepo:
      overrides?.preferenceRepo ?? ({ findByUserId: jest.fn().mockResolvedValue(null) } as any),
    templateRenderer: {
      render: jest
        .fn()
        .mockImplementation((_type: string, _channel: string, vars: Record<string, unknown>) => {
          return Promise.resolve({
            title: `عنوان: ${vars.actorName ?? vars.modTitle ?? vars.targetTitle ?? 'اختبار'}`,
            body: `رسالة اختبار`,
          })
        }),
    },
    eventPublisher,
    jobQueue,
    deduplicationPolicy: deduplicationPolicy as any,
    preferencePolicy: preferencePolicy as any,
    deliveryPolicy: {} as any,
  })

  return {
    service,
    notificationRepo,
    eventPublisher,
    jobQueue,
    preferencePolicy,
    deduplicationPolicy,
  }
}

describe('Notification Integration Flows', () => {
  describe('Comment Reply Flow', () => {
    it('should create notification when user replies to a comment', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendCommentReplyNotification(service)

      await useCase.execute({
        commentOwnerId: 'owner-1',
        replierId: 'replier-1',
        replierName: 'أحمد',
        modId: 'mod-1',
        modTitle: 'لعبة مميزة',
        modSlug: 'test-mod',
        commentId: 'comment-1',
        replyPreview: 'عمل رائع!',
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(2) // InApp + Email
    })

    it('should NOT create notification for self-reply', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendCommentReplyNotification(service)

      await useCase.execute({
        commentOwnerId: 'user-1',
        replierId: 'user-1',
        replierName: 'أحمد',
        modId: 'mod-1',
        modTitle: 'لعبة مميزة',
        modSlug: 'test-mod',
        commentId: 'comment-1',
        replyPreview: 'عمل رائع!',
      })

      expect(notificationRepo.create).not.toHaveBeenCalled()
    })

    it('should send to both in-app and email channels', async () => {
      const { service, jobQueue } = createService()
      const useCase = new SendCommentReplyNotification(service)

      await useCase.execute({
        commentOwnerId: 'owner-1',
        replierId: 'replier-1',
        replierName: 'أحمد',
        modId: 'mod-1',
        modTitle: 'لعبة مميزة',
        modSlug: 'test-mod',
        commentId: 'comment-1',
        replyPreview: 'عمل رائع!',
      })

      expect(jobQueue.jobs).toHaveLength(1)
      expect(jobQueue.jobs[0].channel).toBe(NotificationChannel.Email)
    })
  })

  describe('Top-Level Comment Flow', () => {
    it('should notify mod author of new comment', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendTopLevelCommentNotification(service)

      await useCase.execute({
        modAuthorId: 'author-1',
        commenterId: 'commenter-1',
        commenterName: 'محمد',
        modId: 'mod-1',
        modTitle: 'لعبة عربية',
        modSlug: 'arabic-game',
        commentPreview: 'تعليق رائع',
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(1)
      const created = notificationRepo.created[0]
      expect(created.userId).toBe('author-1')
      expect(created.type).toBe(NotificationType.TopLevelComment)
    })

    it('should NOT notify when author comments on own mod', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendTopLevelCommentNotification(service)

      await useCase.execute({
        modAuthorId: 'author-1',
        commenterId: 'author-1',
        commenterName: 'المطور',
        modId: 'mod-1',
        modTitle: 'لعبة عربية',
        modSlug: 'arabic-game',
        commentPreview: 'تعليق',
      })

      expect(notificationRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('Like Flow', () => {
    it('should notify mod author of like', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendLikeNotification(service)

      await useCase.execute({
        modAuthorId: 'author-1',
        likerId: 'liker-1',
        likerName: 'علي',
        modId: 'mod-1',
        modTitle: 'لعبة جديدة',
        modSlug: 'new-game',
        totalLikes: 10,
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(1)
      const created = notificationRepo.created[0]
      expect(created.userId).toBe('author-1')
      expect(created.type).toBe(NotificationType.Like)
    })

    it('should NOT notify for self-like', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendLikeNotification(service)

      await useCase.execute({
        modAuthorId: 'user-1',
        likerId: 'user-1',
        likerName: 'المطور',
        modId: 'mod-1',
        modTitle: 'لعبة جديدة',
        modSlug: 'new-game',
        totalLikes: 10,
      })

      expect(notificationRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('Follow Flow', () => {
    it('should create notification when user follows another', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendFollowNotification(service)

      await useCase.execute({
        followedUserId: 'user-1',
        followerId: 'follower-1',
        followerName: 'خالد',
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(1)
      const created = notificationRepo.created[0]
      expect(created.userId).toBe('user-1')
      expect(created.type).toBe(NotificationType.Follow)
      expect(created.actorId).toBe('follower-1')
    })

    it('should NOT create notification for self-follow', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendFollowNotification(service)

      await useCase.execute({
        followedUserId: 'user-1',
        followerId: 'user-1',
        followerName: 'المستخدم',
      })

      expect(notificationRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('Endorse Milestone Flow', () => {
    it('should notify mod author of endorsement milestone via in_app and email', async () => {
      const { service, notificationRepo, jobQueue } = createService()
      const useCase = new SendEndorseMilestoneNotification(service)

      await useCase.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة شهيرة',
        modSlug: 'popular-game',
        milestone: 100,
      })

      // Each channel (InApp + Email) creates a notification record
      expect(notificationRepo.create).toHaveBeenCalledTimes(2)
      expect(jobQueue.jobs).toHaveLength(1)
      expect(jobQueue.jobs[0].channel).toBe(NotificationChannel.Email)
    })
  })

  describe('Mod Published Flow', () => {
    it('should create notification when mod is published', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendModPublishedNotification(service)

      await useCase.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة جديدة',
        modSlug: 'new-game',
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(1)
      const created = notificationRepo.created[0]
      expect(created.userId).toBe('author-1')
      expect(created.type).toBe(NotificationType.ModPublished)
    })
  })

  describe('Tier Upgrade Flow', () => {
    it('should create notification on tier upgrade', async () => {
      const { service, notificationRepo, jobQueue } = createService()
      const useCase = new SendTierUpgradeNotification(service)

      await useCase.execute({
        userId: 'user-1',
        fromTier: 1,
        fromTierName: 'عضو',
        toTier: 2,
        toTierName: 'محرر',
        reason: 'إسهامات مميزة',
      })

      // Each channel (InApp + Email) creates a notification record
      expect(notificationRepo.create).toHaveBeenCalledTimes(2)
      const created = notificationRepo.created[0]
      expect(created.type).toBe(NotificationType.TierUpgrade)
      expect(jobQueue.jobs).toHaveLength(1)
    })
  })

  describe('Tier Revoked Flow', () => {
    it('should send notification with skipDeduplication', async () => {
      const { service, deduplicationPolicy } = createService()
      const useCase = new SendTierRevokedNotification(service)

      await useCase.execute({
        userId: 'user-1',
        revokedBy: 'admin-1',
        reason: 'مخالفة القواعد',
      })

      // Deduplication should be skipped for tier revoked
      expect(deduplicationPolicy.check).not.toHaveBeenCalled()
    })
  })

  describe('Report Confirmed Flow', () => {
    it('should send notifications to both target and reporter', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendReportConfirmedNotification(service)

      await useCase.execute({
        reporterId: 'reporter-1',
        targetUserId: 'target-1',
        reportId: 'report-1',
        targetType: 'comment',
        targetTitle: 'تعليق مخالف',
        reason: 'محتوى غير لائق',
        action: 'warned',
        resolution: 'تم التحذير',
        moderatorId: 'mod-1',
      })

      // 2 sends: target (InApp+Email) + reporter (InApp+Email)
      expect(notificationRepo.create).toHaveBeenCalledTimes(4)
    })
  })

  describe('Auto Warning Flow', () => {
    it('should send auto-warning with skipDeduplication', async () => {
      const { service, deduplicationPolicy } = createService()
      const useCase = new SendAutoWarningNotification(service)

      await useCase.execute({
        targetUserId: 'target-1',
        reportId: 'report-1',
        reason: 'انتهاك متكرر',
        resolution: 'تحذير رسمي',
      })

      // Deduplication should be skipped for auto-warning
      expect(deduplicationPolicy.check).not.toHaveBeenCalled()
    })
  })

  describe('Auto Ban Flow', () => {
    it('should send auto-ban with skipDeduplication', async () => {
      const { service, deduplicationPolicy } = createService()
      const useCase = new SendAutoBanNotification(service)

      await useCase.execute({
        targetUserId: 'target-1',
        reportId: 'report-1',
        banType: 'temp_ban',
        durationDays: 7,
      })

      expect(deduplicationPolicy.check).not.toHaveBeenCalled()
    })
  })

  describe('Admin Alert Flow', () => {
    it('should send alert to multiple admins', async () => {
      const { service, notificationRepo } = createService()
      const useCase = new SendAdminAlertNotification(service)

      await useCase.execute({
        adminUserIds: ['admin-1', 'admin-2', 'admin-3'],
        title: 'تنبيه إداري',
        message: 'نشاط مشبوه',
        data: { ip: '1.2.3.4' },
      })

      expect(notificationRepo.create).toHaveBeenCalledTimes(3)
    })
  })

  describe('System Announcement Flow', () => {
    it('should broadcast to all users', async () => {
      const { service, notificationRepo, jobQueue } = createService()
      const useCase = new SendSystemAnnouncementNotification(service)

      await useCase.execute({
        userIds: ['user-1', 'user-2'],
        title: 'إعلان النظام',
        message: 'صيانة مقررة',
        link: '/announcements/1',
      })

      // 2 users × 2 channels = 4 notification records, 2 email jobs
      expect(notificationRepo.create).toHaveBeenCalledTimes(4)
      expect(jobQueue.jobs).toHaveLength(2)
    })
  })

  describe('Preference Enforcement Flow', () => {
    it('should skip email when emailEnabled is false', async () => {
      const refs = createService()
      // Override preference policy to reject email channel
      refs.service['deps'].preferencePolicy = {
        canDeliver: jest
          .fn()
          .mockImplementation(
            async (_userId: string, _type: string, channel: NotificationChannel) => {
              return channel !== NotificationChannel.Email
            },
          ),
        shouldQueueForLater: jest.fn().mockResolvedValue(false),
      } as any

      const result = await refs.service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      })

      expect(result.channelResults).toHaveLength(2)
      expect(result.channelResults[0].success).toBe(true)
      expect(result.channelResults[0].channel).toBe(NotificationChannel.InApp)
      expect(result.channelResults[1].success).toBe(false)
      expect(result.channelResults[1].reason).toBe('preference_disabled')
    })

    it('should skip all notifications when preference disabled', async () => {
      const refs = createService()
      // Override preference policy to reject all
      refs.service['deps'].preferencePolicy = {
        canDeliver: jest.fn().mockResolvedValue(false),
        shouldQueueForLater: jest.fn().mockResolvedValue(false),
      } as any

      const result = await refs.service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.InApp],
      })

      expect(result.success).toBe(false)
      expect(result.channelResults[0].reason).toBe('preference_disabled')
    })
  })

  describe('Deduplication Flow', () => {
    it('should deduplicate when dedup policy returns skip', async () => {
      const { service } = createService()
      service['deps'].deduplicationPolicy = {
        check: jest.fn().mockResolvedValue({ action: 'skip', reason: 'Duplicate' }),
      } as any

      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        title: 'Test',
        message: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.channelResults[0].reason).toBe('deduplicated')
    })

    it('should skip deduplication when skipDeduplication=true', async () => {
      const { service, deduplicationPolicy } = createService()

      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        title: 'Test',
        message: 'Test',
        skipDeduplication: true,
      })

      expect(result.success).toBe(true)
      expect(deduplicationPolicy.check).not.toHaveBeenCalled()
    })
  })

  describe('Multi-Channel Delivery', () => {
    it('should send to both in-app and email channels', async () => {
      const { service, jobQueue, eventPublisher } = createService()

      const result = await service.send({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      })

      expect(result.channelResults).toHaveLength(2)
      expect(result.channelResults[0].channel).toBe(NotificationChannel.InApp)
      expect(result.channelResults[1].channel).toBe(NotificationChannel.Email)
      expect(jobQueue.jobs).toHaveLength(1)
      expect(jobQueue.jobs[0].channel).toBe(NotificationChannel.Email)
      expect(eventPublisher.events).toHaveLength(2)
    })
  })
})
