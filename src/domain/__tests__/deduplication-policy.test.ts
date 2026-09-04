/**
 * DeduplicationPolicy Unit Tests
 */

import { Notification } from '../entities'
import { DEFAULT_DEDUPLICATION_CONFIG, DeduplicationPolicy } from '../policies/deduplication-policy'
import { NotificationType } from '../value-objects'

function createMockNotificationRepo(recentNotification: any = null) {
  return {
    findRecent: jest.fn().mockResolvedValue(recentNotification),
  }
}

describe('DeduplicationPolicy', () => {
  describe('check', () => {
    it('should deduplicate follow within 60 minutes', async () => {
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.Follow, // windowMinutes = 60 (fixed from 0)
        title: 'متابعة جديدة',
        message: 'قام أحمد بمتابعتك',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.Follow, 60)
    })

    it('should return create when no recent notification exists', async () => {
      const repo = createMockNotificationRepo(null)
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.CommentReply, // windowMinutes = 5
        title: 'رد على تعليق',
        message: 'رد أحمد على تعليقك',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('create')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.CommentReply, 5)
    })

    it('should return skip when recent notification exists', async () => {
      const existing = Notification.create({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        title: 'رد على تعليق',
        message: 'رد أحمد على تعليقك',
      })
      const repo = createMockNotificationRepo(existing)
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.CommentReply,
        title: 'رد على تعليق',
        message: 'رد أحمد على تعليقك',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(result.existingNotification).toBe(existing)
      expect(result.reason).toContain('5 minutes')
    })

    it('should deduplicate like within 10 minutes', async () => {
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.Like,
        title: 'إعجاب',
        message: 'أعجب أحمد بتعليقك',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.Like, 10)
    })

    it('should deduplicate admin_action within 60 minutes', async () => {
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.AdminAction,
        title: 'إجراء إداري',
        message: 'تم اتخاذ إجراء',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.AdminAction, 60)
    })

    it('should deduplicate admin_report within 30 minutes', async () => {
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.AdminReport,
        title: 'بلاغ',
        message: 'بلاغ جديد',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.AdminReport, 30)
    })

    it('should not deduplicate tier_upgrade (window = 0)', async () => {
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.TierUpgrade,
        title: 'ترقية',
        message: 'تمت ترقيتك',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('create')
      expect(repo.findRecent).not.toHaveBeenCalled()
    })

    it('should use custom config when provided', async () => {
      const customConfig = {
        windowMinutes: {
          ...DEFAULT_DEDUPLICATION_CONFIG.windowMinutes,
          [NotificationType.Follow]: 5, // Override: normally 0
        },
      }
      const repo = createMockNotificationRepo({ id: 'existing' })
      const policy = new DeduplicationPolicy(repo as any, customConfig)

      const notification = Notification.create({
        userId: 'user-1',
        type: NotificationType.Follow,
        title: 'متابعة',
        message: 'متابع جديد',
      })

      const result = await policy.check(notification)

      expect(result.action).toBe('skip')
      expect(repo.findRecent).toHaveBeenCalledWith('user-1', NotificationType.Follow, 5)
    })
  })
})
