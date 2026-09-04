/**
 * PreferencePolicy Unit Tests
 */

import { PreferencePolicy } from '../policies/preference-policy'
import { NotificationChannel, NotificationType } from '../value-objects'

function createMockPreferenceRepo(preference: any = null) {
  return {
    findByUserId: jest.fn().mockResolvedValue(preference),
  }
}

describe('PreferencePolicy', () => {
  describe('canDeliver', () => {
    it('should return true when no preferences exist (defaults)', async () => {
      const repo = createMockPreferenceRepo(null)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.canDeliver(
        'user-1',
        NotificationType.CommentReply,
        NotificationChannel.InApp,
      )

      expect(result).toBe(true)
    })

    it('should delegate to preference.canDeliver', async () => {
      const mockPref = {
        canDeliver: jest.fn().mockReturnValue(true),
      }
      const repo = createMockPreferenceRepo(mockPref)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.canDeliver(
        'user-1',
        NotificationType.CommentReply,
        NotificationChannel.Email,
      )

      expect(result).toBe(true)
      expect(mockPref.canDeliver).toHaveBeenCalledWith(
        NotificationType.CommentReply,
        NotificationChannel.Email,
      )
    })

    it('should return false when preference denies delivery', async () => {
      const mockPref = {
        canDeliver: jest.fn().mockReturnValue(false),
      }
      const repo = createMockPreferenceRepo(mockPref)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.canDeliver(
        'user-1',
        NotificationType.Like,
        NotificationChannel.Email,
      )

      expect(result).toBe(false)
    })
  })

  describe('shouldQueueForLater', () => {
    it('should return false when no preferences exist', async () => {
      const repo = createMockPreferenceRepo(null)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.shouldQueueForLater('user-1', new Date())

      expect(result).toBe(false)
    })

    it('should return false when quiet hours disabled', async () => {
      const mockPref = {
        quietHoursEnabled: false,
      }
      const repo = createMockPreferenceRepo(mockPref)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.shouldQueueForLater('user-1', new Date())

      expect(result).toBe(false)
    })

    it('should delegate to preference.isInQuietHours', async () => {
      const nightTime = new Date()
      nightTime.setHours(23, 30, 0, 0)

      const mockPref = {
        quietHoursEnabled: true,
        isInQuietHours: jest.fn().mockReturnValue(true),
      }
      const repo = createMockPreferenceRepo(mockPref)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.shouldQueueForLater('user-1', nightTime)

      expect(result).toBe(true)
      expect(mockPref.isInQuietHours).toHaveBeenCalledWith(nightTime)
    })

    it('should return false when not in quiet hours', async () => {
      const mockPref = {
        quietHoursEnabled: true,
        isInQuietHours: jest.fn().mockReturnValue(false),
      }
      const repo = createMockPreferenceRepo(mockPref)
      const policy = new PreferencePolicy(repo as any)

      const result = await policy.shouldQueueForLater('user-1', new Date())

      expect(result).toBe(false)
    })
  })
})
