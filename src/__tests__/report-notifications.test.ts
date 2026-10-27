import { NotificationChannel, NotificationType } from '@/domain'
import type { NotificationService } from '@/application/services'
import { SendReportConfirmedNotification } from '@/application/use-cases/reports/send-report-confirmed'
import { SendReportRejectedNotification } from '@/application/use-cases/reports/send-report-rejected'
import { SendAutoWarningNotification } from '@/application/use-cases/reports/send-auto-warning'
import { SendAutoBanNotification } from '@/application/use-cases/reports/send-auto-ban'

function mockService() {
  return { send: jest.fn().mockResolvedValue({ success: true }) } as any as jest.Mocked<NotificationService>
}

describe('report notifications', () => {
  it('confirmed target notification includes non-empty actionMessage', async () => {
    const svc = mockService()
    const uc = new SendReportConfirmedNotification(svc)
    await uc.execute({
      reporterId: 'reporter-1',
      targetUserId: 'target-1',
      reportId: 'report-1',
      targetType: 'mod',
      targetTitle: 'Test Mod',
      reason: 'Spam',
      action: 'warned',
      resolution: 'تم التحذير',
      moderatorId: 'mod-1',
    })
    const first = (svc.send as jest.Mock).mock.calls[0][0]
    expect(first.templateVariables.actionMessage).toBeTruthy()
  })

  it('rejected notification includes non-empty actionMessage', async () => {
    const svc = mockService()
    const uc = new SendReportRejectedNotification(svc)
    await uc.execute({
      reporterId: 'reporter-1',
      reportId: 'report-1',
      targetType: 'mod',
      targetTitle: 'Test Mod',
      reason: 'Spam',
      resolution: 'غير مبرر',
      moderatorId: 'mod-1',
    })
    const call = (svc.send as jest.Mock).mock.calls[0][0]
    expect(call.templateVariables.actionMessage).toBeTruthy()
  })

  it('auto-warning notification includes non-empty actionMessage', async () => {
    const svc = mockService()
    const uc = new SendAutoWarningNotification(svc)
    await uc.execute({
      targetUserId: 'target-1',
      reportId: 'report-1',
      reason: 'انتهاك',
      resolution: 'تحذير',
    })
    const call = (svc.send as jest.Mock).mock.calls[0][0]
    expect(call.templateVariables.actionMessage).toBeTruthy()
  })

  it('auto-ban notification includes non-empty actionMessage', async () => {
    const svc = mockService()
    const uc = new SendAutoBanNotification(svc)
    await uc.execute({
      targetUserId: 'target-1',
      reportId: 'report-1',
      banType: 'temp_ban',
      durationDays: 7,
    })
    const call = (svc.send as jest.Mock).mock.calls[0][0]
    expect(call.templateVariables.actionMessage).toBeTruthy()
  })

  it('confirmed sends one target + one reporter notification', async () => {
    const svc = mockService()
    const uc = new SendReportConfirmedNotification(svc)
    await uc.execute({
      reporterId: 'reporter-1',
      targetUserId: 'target-1',
      reportId: 'report-1',
      targetType: 'mod',
      targetTitle: 'Test Mod',
      reason: 'Spam',
      action: 'warned',
      moderatorId: 'mod-1',
    })
    expect(svc.send).toHaveBeenCalledTimes(2)
  })
})
