import { NotificationQueryService } from '../services/notification-query-service'
import type { NotificationRepository } from '@/domain'
import { Notification, NotificationType } from '@/domain'

describe('NotificationQueryService', () => {
  let service: NotificationQueryService
  let mockRepo: jest.Mocked<NotificationRepository>

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn().mockResolvedValue([]),
      findUnreadCount: jest.fn().mockResolvedValue(0),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      findRecent: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }

    service = new NotificationQueryService(mockRepo)
  })

  it('should return paginated notifications', async () => {
    const notification = Notification.create({
      userId: 'user-1',
      type: NotificationType.CommentReply,
      title: 'Test',
      message: 'Test message',
    })
    mockRepo.findByUserId.mockResolvedValue([notification])
    mockRepo.findUnreadCount.mockResolvedValue(5)

    const result = await service.getNotifications('user-1', 1, 20)

    expect(result.notifications).toHaveLength(1)
    expect(result.unreadCount).toBe(5)
    expect(result.pagination.page).toBe(1)
  })

  it('should return unread count', async () => {
    mockRepo.findUnreadCount.mockResolvedValue(10)

    const count = await service.getUnreadCount('user-1')

    expect(count).toBe(10)
  })
})
