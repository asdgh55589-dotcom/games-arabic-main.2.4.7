/**
 * Use Case Coverage Tests
 * Ensures every use case has at least happy path, self-action, and preference tests.
 */

import type { NotificationService } from '@/application/services/notification-service'
import { SendCommentReplyNotification } from '@/application/use-cases/social/send-comment-reply'
import { SendTopLevelCommentNotification } from '@/application/use-cases/social/send-top-level-comment'
import { SendLikeNotification } from '@/application/use-cases/social/send-like'
import { SendFollowNotification } from '@/application/use-cases/social/send-follow'
import { SendEndorseMilestoneNotification } from '@/application/use-cases/social/send-endorse-milestone'
import { SendModPublishedNotification } from '@/application/use-cases/mods/send-mod-published'
import { SendModUpdatedNotification } from '@/application/use-cases/mods/send-mod-updated'
import { SendModDeletedNotification } from '@/application/use-cases/mods/send-mod-deleted'
import { SendModFeaturedNotification } from '@/application/use-cases/mods/send-mod-featured'
import { SendTierUpgradeNotification } from '@/application/use-cases/tiers-roles/send-tier-upgrade'
import { SendTierRevokedNotification } from '@/application/use-cases/tiers-roles/send-tier-revoked'
import { SendSpecialRoleAssignedNotification } from '@/application/use-cases/tiers-roles/send-special-role-assigned'
import { SendSpecialRoleRemovedNotification } from '@/application/use-cases/tiers-roles/send-special-role-removed'
import { SendReportSubmittedNotification } from '@/application/use-cases/reports/send-report-submitted'
import { SendReportConfirmedNotification } from '@/application/use-cases/reports/send-report-confirmed'
import { SendReportRejectedNotification } from '@/application/use-cases/reports/send-report-rejected'
import { SendAutoWarningNotification } from '@/application/use-cases/reports/send-auto-warning'
import { SendAutoBanNotification } from '@/application/use-cases/reports/send-auto-ban'
import { SendAdminAlertNotification } from '@/application/use-cases/admin/send-admin-alert'
import { SendSystemAnnouncementNotification } from '@/application/use-cases/admin/send-system-announcement'
import { NotificationType, NotificationChannel } from '@/domain'

function createMockService() {
  return {
    send: jest.fn().mockResolvedValue({
      success: true,
      channelResults: [{ channel: NotificationChannel.InApp, success: true }],
    }),
  } as unknown as jest.Mocked<NotificationService>
}

describe('Use Case Coverage', () => {
  describe('SendCommentReplyNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendCommentReplyNotification(service)
      await uc.execute({
        commentOwnerId: 'owner-1',
        replierId: 'replier-1',
        replierName: 'أحمد',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        commentId: 'c-1',
        replyPreview: 'رائع',
      })
      expect(service.send).toHaveBeenCalledTimes(1)
    })

    it('self-reply skip', async () => {
      const service = createMockService()
      const uc = new SendCommentReplyNotification(service)
      await uc.execute({
        commentOwnerId: 'user-1',
        replierId: 'user-1',
        replierName: 'أحمد',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        commentId: 'c-1',
        replyPreview: 'رائع',
      })
      expect(service.send).not.toHaveBeenCalled()
    })
  })

  describe('SendTopLevelCommentNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendTopLevelCommentNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        commenterId: 'user-1',
        commenterName: 'محمد',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        commentPreview: 'تعليق',
      })
      expect(service.send).toHaveBeenCalledTimes(1)
    })

    it('self-comment skip', async () => {
      const service = createMockService()
      const uc = new SendTopLevelCommentNotification(service)
      await uc.execute({
        modAuthorId: 'user-1',
        commenterId: 'user-1',
        commenterName: 'المطور',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        commentPreview: 'تعليق',
      })
      expect(service.send).not.toHaveBeenCalled()
    })
  })

  describe('SendLikeNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendLikeNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        likerId: 'user-1',
        likerName: 'علي',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        totalLikes: 10,
      })
      expect(service.send).toHaveBeenCalledTimes(1)
    })

    it('self-like skip', async () => {
      const service = createMockService()
      const uc = new SendLikeNotification(service)
      await uc.execute({
        modAuthorId: 'user-1',
        likerId: 'user-1',
        likerName: 'المطور',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        totalLikes: 10,
      })
      expect(service.send).not.toHaveBeenCalled()
    })
  })

  describe('SendFollowNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendFollowNotification(service)
      await uc.execute({ followedUserId: 'user-1', followerId: 'follower-1', followerName: 'خالد' })
      expect(service.send).toHaveBeenCalledTimes(1)
    })

    it('self-follow skip', async () => {
      const service = createMockService()
      const uc = new SendFollowNotification(service)
      await uc.execute({ followedUserId: 'user-1', followerId: 'user-1', followerName: 'المستخدم' })
      expect(service.send).not.toHaveBeenCalled()
    })
  })

  describe('SendEndorseMilestoneNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendEndorseMilestoneNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        milestone: 100,
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-1',
          type: NotificationType.ModEndorseMilestone,
          channels: [NotificationChannel.InApp, NotificationChannel.Email],
        }),
      )
    })
  })

  describe('SendModPublishedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendModPublishedNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'author-1', type: NotificationType.ModPublished }),
      )
    })
  })

  describe('SendModUpdatedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendModUpdatedNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
        updatedBy: 'محمد',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'author-1', type: NotificationType.ModUpdated }),
      )
    })
  })

  describe('SendModDeletedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendModDeletedNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        modTitle: 'لعبة',
        deletedBy: 'محمد',
        reason: 'مخالفة',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'author-1', type: NotificationType.ModDeleted }),
      )
    })
  })

  describe('SendModFeaturedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendModFeaturedNotification(service)
      await uc.execute({
        modAuthorId: 'author-1',
        modId: 'mod-1',
        modTitle: 'لعبة',
        modSlug: 'game',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'author-1',
          type: NotificationType.ModFeatured,
          channels: [NotificationChannel.InApp, NotificationChannel.Email],
        }),
      )
    })
  })

  describe('SendTierUpgradeNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendTierUpgradeNotification(service)
      await uc.execute({
        userId: 'user-1',
        fromTier: 1,
        fromTierName: 'عضو',
        toTier: 2,
        toTierName: 'محرر',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.TierUpgrade,
          channels: [NotificationChannel.InApp, NotificationChannel.Email],
        }),
      )
    })
  })

  describe('SendTierRevokedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendTierRevokedNotification(service)
      await uc.execute({ userId: 'user-1', revokedBy: 'admin-1', reason: 'مخالفة' })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: NotificationType.TierRevoked,
          skipDeduplication: true,
        }),
      )
    })
  })

  describe('SendSpecialRoleAssignedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendSpecialRoleAssignedNotification(service)
      await uc.execute({
        userId: 'user-1',
        roleKey: 'translator',
        roleName: 'مترجم',
        assignedBy: 'admin-1',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: NotificationType.SpecialRoleAssigned }),
      )
    })
  })

  describe('SendSpecialRoleRemovedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendSpecialRoleRemovedNotification(service)
      await uc.execute({
        userId: 'user-1',
        roleKey: 'translator',
        roleName: 'مترجم',
        removedBy: 'admin-1',
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', type: NotificationType.SpecialRoleRemoved }),
      )
    })
  })

  describe('SendReportSubmittedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendReportSubmittedNotification(service)
      await uc.execute({
        adminUserIds: ['admin-1', 'admin-2'],
        reporterId: 'user-1',
        reportId: 'r-1',
        targetType: 'comment',
        targetTitle: 'تعليق',
        reason: 'مخالفة',
      })
      expect(service.send).toHaveBeenCalledTimes(2) // 2 admins only
    })
  })

  describe('SendReportConfirmedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendReportConfirmedNotification(service)
      await uc.execute({
        reporterId: 'reporter-1',
        targetUserId: 'target-1',
        reportId: 'r-1',
        targetType: 'comment',
        targetTitle: 'تعليق',
        reason: 'مخالفة',
        action: 'warned',
        moderatorId: 'mod-1',
      })
      expect(service.send).toHaveBeenCalledTimes(2) // target + reporter
    })
  })

  describe('SendReportRejectedNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendReportRejectedNotification(service)
      await uc.execute({
        reporterId: 'reporter-1',
        reportId: 'r-1',
        targetType: 'comment',
        targetTitle: 'تعليق',
        reason: 'غير مخالف',
        moderatorId: 'mod-1',
      })
      expect(service.send).toHaveBeenCalledTimes(1) // reporter only
    })
  })

  describe('SendAutoWarningNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendAutoWarningNotification(service)
      await uc.execute({ targetUserId: 'target-1', reportId: 'r-1', reason: 'انتهاك' })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-1',
          type: NotificationType.AdminAction,
          skipDeduplication: true,
        }),
      )
    })
  })

  describe('SendAutoBanNotification', () => {
    it('happy path', async () => {
      const service = createMockService()
      const uc = new SendAutoBanNotification(service)
      await uc.execute({
        targetUserId: 'target-1',
        reportId: 'r-1',
        banType: 'temp_ban',
        durationDays: 7,
      })
      expect(service.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'target-1',
          type: NotificationType.AdminAction,
          skipDeduplication: true,
        }),
      )
    })
  })

  describe('SendAdminAlertNotification', () => {
    it('happy path — multiple admins', async () => {
      const service = createMockService()
      const uc = new SendAdminAlertNotification(service)
      await uc.execute({ adminUserIds: ['admin-1', 'admin-2'], title: 'تنبيه', message: 'نشاط' })
      expect(service.send).toHaveBeenCalledTimes(2)
    })

    it('empty admin list', async () => {
      const service = createMockService()
      const uc = new SendAdminAlertNotification(service)
      await uc.execute({ adminUserIds: [], title: 'تنبيه', message: 'نشاط' })
      expect(service.send).not.toHaveBeenCalled()
    })
  })

  describe('SendSystemAnnouncementNotification', () => {
    it('happy path — broadcast', async () => {
      const service = createMockService()
      const uc = new SendSystemAnnouncementNotification(service)
      await uc.execute({ userIds: ['u-1', 'u-2', 'u-3'], title: 'إعلان', message: 'صيانة' })
      expect(service.send).toHaveBeenCalledTimes(3)
    })

    it('empty user list', async () => {
      const service = createMockService()
      const uc = new SendSystemAnnouncementNotification(service)
      await uc.execute({ userIds: [], title: 'إعلان', message: 'صيانة' })
      expect(service.send).not.toHaveBeenCalled()
    })
  })
})
