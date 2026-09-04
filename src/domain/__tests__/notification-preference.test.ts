import { NotificationPreference } from '../entities/notification-preference'
import { NotificationType, NotificationChannel } from '../value-objects'

describe('NotificationPreference Entity', () => {
  describe('createDefault', () => {
    it('should create default preferences for a user', () => {
      const pref = NotificationPreference.createDefault('user-123')

      expect(pref.userId).toBe('user-123')
      expect(pref.emailEnabled).toBe(true)
      expect(pref.pushEnabled).toBe(true)
      expect(pref.dailySummary).toBe(true)
      expect(pref.summaryIntervalDays).toBe(3)
      expect(pref.likeThreshold).toBe(25)
      expect(pref.quietHoursEnabled).toBe(false)
      expect(pref.quietHoursStart).toBeNull()
      expect(pref.quietHoursEnd).toBeNull()
      expect(pref.typePreferences).toEqual({})
      expect(pref.id).toBeTruthy()
    })

    it('should throw if userId is empty', () => {
      expect(() => NotificationPreference.createDefault('')).toThrow(
        'NotificationPreference.userId is required',
      )
    })
  })

  describe('reconstruct', () => {
    it('should reconstruct from props', () => {
      const now = new Date()
      const pref = NotificationPreference.reconstruct({
        id: 'pref-1',
        userId: 'user-123',
        emailEnabled: false,
        pushEnabled: true,
        dailySummary: false,
        summaryIntervalDays: 7,
        likeThreshold: 50,
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
        typePreferences: {
          [NotificationType.CommentReply]: { enabled: false },
        },
        createdAt: now,
        updatedAt: now,
      })

      expect(pref.emailEnabled).toBe(false)
      expect(pref.quietHoursStart).toBe('23:00')
      expect(pref.typePreferences[NotificationType.CommentReply]).toEqual({
        enabled: false,
      })
    })
  })

  describe('canDeliver', () => {
    it('should return true when all checks pass', () => {
      const pref = NotificationPreference.createDefault('user-123')
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp)).toBe(true)
    })

    it('should return false when email is disabled', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        emailEnabled: false,
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.Email)).toBe(false)
    })

    it('should return false when push is disabled', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        pushEnabled: false,
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp)).toBe(false)
    })

    it('should return false when type is disabled', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        typePreferences: {
          [NotificationType.CommentReply]: { enabled: false },
        },
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp)).toBe(false)
    })

    it('should return false when type email is disabled for email channel', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        typePreferences: {
          [NotificationType.CommentReply]: { enabled: true, emailEnabled: false },
        },
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.Email)).toBe(false)
    })

    it('should return false when type push is disabled for in-app channel', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        typePreferences: {
          [NotificationType.CommentReply]: { enabled: true, pushEnabled: false },
        },
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp)).toBe(false)
    })

    it('should return true when type email is disabled but checking in-app channel', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        typePreferences: {
          [NotificationType.CommentReply]: { enabled: true, emailEnabled: false },
        },
      })
      expect(pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp)).toBe(true)
    })

    it('should return false during quiet hours for in-app', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      })

      const nightTime = new Date()
      nightTime.setHours(23, 30, 0, 0)

      expect(
        pref.canDeliver(NotificationType.CommentReply, NotificationChannel.InApp, nightTime),
      ).toBe(false)
    })

    it('should allow email during quiet hours', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
      })

      const nightTime = new Date()
      nightTime.setHours(23, 30, 0, 0)

      expect(
        pref.canDeliver(NotificationType.CommentReply, NotificationChannel.Email, nightTime),
      ).toBe(true)
    })
  })

  describe('isInQuietHours', () => {
    it('should return false when quiet hours disabled', () => {
      const pref = NotificationPreference.createDefault('user-123')
      expect(pref.isInQuietHours(new Date())).toBe(false)
    })

    it('should detect same-day quiet hours', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        quietHoursEnabled: true,
        quietHoursStart: '08:00',
        quietHoursEnd: '22:00',
      })

      const morning = new Date()
      morning.setHours(10, 0, 0, 0)
      expect(pref.isInQuietHours(morning)).toBe(true)

      const night = new Date()
      night.setHours(23, 0, 0, 0)
      expect(pref.isInQuietHours(night)).toBe(false)
    })

    it('should detect overnight quiet hours', () => {
      const pref = NotificationPreference.createDefault('user-123').updatePreference({
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
      })

      const night = new Date()
      night.setHours(23, 30, 0, 0)
      expect(pref.isInQuietHours(night)).toBe(true)

      const earlyMorning = new Date()
      earlyMorning.setHours(5, 0, 0, 0)
      expect(pref.isInQuietHours(earlyMorning)).toBe(true)

      const afternoon = new Date()
      afternoon.setHours(14, 0, 0, 0)
      expect(pref.isInQuietHours(afternoon)).toBe(false)
    })
  })

  describe('updatePreference', () => {
    it('should return new instance with updated values', () => {
      const pref = NotificationPreference.createDefault('user-123')
      const updated = pref.updatePreference({
        emailEnabled: false,
        likeThreshold: 50,
      })

      expect(updated.emailEnabled).toBe(false)
      expect(updated.likeThreshold).toBe(50)
      // Original unchanged
      expect(pref.emailEnabled).toBe(true)
      expect(pref.likeThreshold).toBe(25)
    })

    it('should preserve unchanged values', () => {
      const pref = NotificationPreference.createDefault('user-123')
      const updated = pref.updatePreference({ emailEnabled: false })

      expect(updated.pushEnabled).toBe(true)
      expect(updated.dailySummary).toBe(true)
      expect(updated.summaryIntervalDays).toBe(3)
    })
  })
})
