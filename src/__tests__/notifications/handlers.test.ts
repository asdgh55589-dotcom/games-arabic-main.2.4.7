import { handleTranslatorLike } from '@/lib/notifications/handlers/translator-like-handler'
import { handleTranslatorComment } from '@/lib/notifications/handlers/translator-comment-handler'
import { handleCommentReply } from '@/lib/notifications/handlers/comment-reply-handler'
import { NotificationType } from '@/lib/notifications/types'

jest.mock('@/lib/db', () => ({
  db: {
    mod: {
      findUnique: jest.fn()
    },
    endorsement: {
      count: jest.fn()
    },
    modComment: {
      findUnique: jest.fn()
    },
    notification: {
      create: jest.fn()
    },
    notificationPreference: {
      findUnique: jest.fn()
    }
  }
}))

jest.mock('@/lib/notifications/realtime', () => ({
  sendRealtimeNotification: jest.fn()
}))

describe('Notification Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleTranslatorLike', () => {
    it('should create notification when threshold is reached', async () => {
      const { db } = require('@/lib/db')
      db.mod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        authorId: 'user1',
        author: { id: 'user1' }
      })
      db.endorsement.count.mockResolvedValue(25)
      db.notificationPreference.findUnique.mockResolvedValue({
        likeThreshold: 25
      })

      await handleTranslatorLike('1', 'liker1')

      expect(db.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.Like,
          }),
        })
      )
    })

    it('should not create notification below threshold', async () => {
      const { db } = require('@/lib/db')
      db.mod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        authorId: 'user1',
        author: { id: 'user1' }
      })
      db.endorsement.count.mockResolvedValue(24)
      db.notificationPreference.findUnique.mockResolvedValue({
        likeThreshold: 25
      })

      await handleTranslatorLike('1', 'liker1')

      expect(db.notification.create).not.toHaveBeenCalled()
    })

    it('should not create notification for self-likes', async () => {
      const { db } = require('@/lib/db')
      db.mod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        authorId: 'user1',
        author: { id: 'user1' }
      })

      await handleTranslatorLike('1', 'user1')

      expect(db.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('handleTranslatorComment', () => {
    it('should create notification for comment on translation', async () => {
      const { db } = require('@/lib/db')
      db.mod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        authorId: 'user1',
        author: { id: 'user1' }
      })

      await handleTranslatorComment('1', 'comment1', 'commenter1')

      expect(db.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.CommentReply,
          }),
        })
      )
    })

    it('should not create notification for self-comments', async () => {
      const { db } = require('@/lib/db')
      db.mod.findUnique.mockResolvedValue({
        id: '1',
        name: 'Test',
        authorId: 'user1',
        author: { id: 'user1' }
      })

      await handleTranslatorComment('1', 'comment1', 'user1')

      expect(db.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('handleCommentReply', () => {
    it('should create notification for reply to comment', async () => {
      const { db } = require('@/lib/db')
      db.modComment.findUnique.mockResolvedValue({
        id: '1',
        text: 'Test comment',
        userId: 'user1',
        user: { id: 'user1' }
      })

      await handleCommentReply('1', 'reply1', 'replier1')

      expect(db.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: NotificationType.CommentReply,
          }),
        })
      )
    })

    it('should not create notification for self-replies', async () => {
      const { db } = require('@/lib/db')
      db.modComment.findUnique.mockResolvedValue({
        id: '1',
        text: 'Test comment',
        userId: 'user1',
        user: { id: 'user1' }
      })

      await handleCommentReply('1', 'reply1', 'user1')

      expect(db.notification.create).not.toHaveBeenCalled()
    })
  })
})
