import { SendCommentReplyNotification } from '../use-cases/social/send-comment-reply'
import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../services'

describe('SendCommentReplyNotification', () => {
  let useCase: SendCommentReplyNotification
  let mockService: jest.Mocked<NotificationService>

  beforeEach(() => {
    mockService = {
      send: jest.fn().mockResolvedValue({ success: true }),
    } as any

    useCase = new SendCommentReplyNotification(mockService)
  })

  it('should send notification to comment owner', async () => {
    await useCase.execute({
      commentOwnerId: 'owner-1',
      replierId: 'replier-1',
      replierName: 'Ahmad',
      modId: 'mod-1',
      modTitle: 'Test Mod',
      modSlug: 'test-mod',
      commentId: 'comment-1',
      replyPreview: 'Nice work!',
    })

    expect(mockService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'owner-1',
        type: NotificationType.CommentReply,
        actorId: 'replier-1',
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
      }),
    )
  })

  it('should skip self-reply', async () => {
    await useCase.execute({
      commentOwnerId: 'user-1',
      replierId: 'user-1',
      replierName: 'Ahmad',
      modId: 'mod-1',
      modTitle: 'Test Mod',
      modSlug: 'test-mod',
      commentId: 'comment-1',
      replyPreview: 'Nice work!',
    })

    expect(mockService.send).not.toHaveBeenCalled()
  })
})
