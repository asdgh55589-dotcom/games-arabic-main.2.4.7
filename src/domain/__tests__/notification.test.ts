import { Notification } from '../entities/notification'
import { NotificationType } from '../value-objects'

describe('Notification Entity', () => {
  const validProps = {
    userId: 'user-123',
    type: NotificationType.CommentReply,
    title: 'رد على تعليقك',
    message: 'قام شخص بالرد على تعليقك',
  }

  describe('create', () => {
    it('should create a notification with valid props', () => {
      const notification = Notification.create(validProps)

      expect(notification.userId).toBe('user-123')
      expect(notification.type).toBe(NotificationType.CommentReply)
      expect(notification.title).toBe('رد على تعليقك')
      expect(notification.message).toBe('قام شخص بالرد على تعليقك')
      expect(notification.isRead).toBe(false)
      expect(notification.readAt).toBeNull()
      expect(notification.actorId).toBeNull()
      expect(notification.data).toBeNull()
      expect(notification.id).toBeTruthy()
      expect(notification.createdAt).toBeInstanceOf(Date)
      expect(notification.updatedAt).toBeInstanceOf(Date)
    })

    it('should create with optional props', () => {
      const notification = Notification.create({
        ...validProps,
        actorId: 'actor-456',
        data: { link: '/mod/test' },
      })

      expect(notification.actorId).toBe('actor-456')
      expect(notification.data).toEqual({ link: '/mod/test' })
    })

    it('should trim whitespace from title and message', () => {
      const notification = Notification.create({
        ...validProps,
        title: '  عنوان  ',
        message: '  رسالة  ',
      })

      expect(notification.title).toBe('عنوان')
      expect(notification.message).toBe('رسالة')
    })

    it('should throw if userId is missing', () => {
      expect(() =>
        Notification.create({ ...validProps, userId: '' }),
      ).toThrow('Notification.userId is required')
    })

    it('should throw if type is missing', () => {
      expect(() =>
        Notification.create({ ...validProps, type: '' as NotificationType }),
      ).toThrow('Notification.type is required')
    })

    it('should throw if title is empty', () => {
      expect(() =>
        Notification.create({ ...validProps, title: '' }),
      ).toThrow('Notification.title is required')
    })

    it('should throw if title is whitespace only', () => {
      expect(() =>
        Notification.create({ ...validProps, title: '   ' }),
      ).toThrow('Notification.title is required')
    })

    it('should throw if message is empty', () => {
      expect(() =>
        Notification.create({ ...validProps, message: '' }),
      ).toThrow('Notification.message is required')
    })
  })

  describe('reconstruct', () => {
    it('should reconstruct without validation', () => {
      const now = new Date()
      const notification = Notification.reconstruct({
        id: 'existing-id',
        userId: 'user-123',
        actorId: null,
        type: NotificationType.CommentReply,
        title: 'test',
        message: 'test',
        data: null,
        isRead: true,
        readAt: now,
        createdAt: now,
        updatedAt: now,
      })

      expect(notification.id).toBe('existing-id')
      expect(notification.isRead).toBe(true)
      expect(notification.readAt).toBe(now)
    })
  })

  describe('markAsRead', () => {
    it('should return new instance with isRead=true', () => {
      const notification = Notification.create(validProps)
      const readNotification = notification.markAsRead()

      expect(readNotification.isRead).toBe(true)
      expect(readNotification.readAt).toBeInstanceOf(Date)
      expect(readNotification.id).toBe(notification.id)
      // Original unchanged
      expect(notification.isRead).toBe(false)
    })
  })

  describe('updateMessage', () => {
    it('should return new instance with updated message', () => {
      const notification = Notification.create(validProps)
      const updated = notification.updateMessage('رسالة جديدة')

      expect(updated.message).toBe('رسالة جديدة')
      expect(updated.id).toBe(notification.id)
      // Original unchanged
      expect(notification.message).toBe('قام شخص بالرد على تعليقك')
    })

    it('should throw if message is empty', () => {
      const notification = Notification.create(validProps)
      expect(() => notification.updateMessage('')).toThrow(
        'Notification.message cannot be empty',
      )
    })
  })

  describe('belongsTo', () => {
    it('should return true for matching userId', () => {
      const notification = Notification.create(validProps)
      expect(notification.belongsTo('user-123')).toBe(true)
    })

    it('should return false for non-matching userId', () => {
      const notification = Notification.create(validProps)
      expect(notification.belongsTo('other-user')).toBe(false)
    })
  })

  describe('isTriggeredBy', () => {
    it('should return true for matching actorId', () => {
      const notification = Notification.create({
        ...validProps,
        actorId: 'actor-456',
      })
      expect(notification.isTriggeredBy('actor-456')).toBe(true)
    })

    it('should return false for null actorId', () => {
      const notification = Notification.create(validProps)
      expect(notification.isTriggeredBy('actor-456')).toBe(false)
    })
  })
})
