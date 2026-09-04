import { SendReportConfirmedNotification } from '../use-cases/reports/send-report-confirmed'
import { NotificationType, NotificationChannel } from '@/domain'
import type { NotificationService } from '../services'

describe('SendReportConfirmedNotification', () => {
  let useCase: SendReportConfirmedNotification
  let mockService: jest.Mocked<NotificationService>

  beforeEach(() => {
    mockService = {
      send: jest.fn().mockResolvedValue({ success: true }),
    } as any

    useCase = new SendReportConfirmedNotification(mockService)
  })

  it('should send ONE notification to target user (not 3)', async () => {
    await useCase.execute({
      reporterId: 'reporter-1',
      targetUserId: 'target-1',
      reportId: 'report-1',
      targetType: 'mod',
      targetTitle: 'Test Mod',
      reason: 'Spam',
      action: 'warned',
      moderatorId: 'mod-1',
    })

    // Should send exactly 2 notifications:
    // 1. To target user (admin_action)
    // 2. To reporter (admin_action with outcome)
    expect(mockService.send).toHaveBeenCalledTimes(2)

    // First call: to target user
    expect(mockService.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'target-1',
        type: NotificationType.AdminAction,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
        skipDeduplication: false,
      }),
    )

    // Second call: to reporter
    expect(mockService.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        userId: 'reporter-1',
        type: NotificationType.AdminAction,
        channels: [NotificationChannel.InApp, NotificationChannel.Email],
        skipDeduplication: true,
      }),
    )
  })

  it('should NOT send duplicate notifications for target user', async () => {
    // This is the critical fix — the old code sent 3 notifications to target
    await useCase.execute({
      reporterId: 'reporter-1',
      targetUserId: 'target-1',
      reportId: 'report-1',
      targetType: 'mod',
      targetTitle: 'Test Mod',
      reason: 'Spam',
      action: 'temp_ban',
      moderatorId: 'mod-1',
    })

    // Count notifications to target user
    const targetNotifications = mockService.send.mock.calls.filter(
      (call) => call[0].userId === 'target-1',
    )
    expect(targetNotifications).toHaveLength(1)
  })
})
