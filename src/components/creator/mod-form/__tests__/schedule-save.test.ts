/**
 * اختبار saveModSchedule: شكل الحمولة المرسلة للنقطتين (admin/creator).
 */
import { saveModSchedule } from '../files'

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('saveModSchedule', () => {
  it('يرسل الوضعية والموعد مرة واحدة + الأهداف اليدوية عند التفعيل', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { project: { id: 'p' } } }),
    })

    await saveModSchedule({
      saveUrl: '/api/admin/schedule-projects',
      modId: 'mod-1',
      value: {
        mode: 'both',
        datetime: '2026-10-20T12:00:00.000Z',
        manualTargets: [{ destinationId: 'd1', threadId: 2, botId: null }],
        useManualTargets: true,
      },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/schedule-projects',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mode":"both"'),
      }),
    )
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(sent).toMatchObject({
      modId: 'mod-1',
      sitePublishAt: '2026-10-20T12:00:00.000Z',
      socialPublishAt: '2026-10-20T12:00:00.000Z',
      status: 'scheduled',
      targets: [{ destinationId: 'd1', threadId: 2, botId: null }],
    })
  })

  it('بلا تجاوز يدوي: لا حقل targets (الخادم يستنتج)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    })

    await saveModSchedule({
      saveUrl: '/api/creator/schedule-projects',
      modId: 'mod-1',
      value: { mode: 'site_only', datetime: '2026-10-20T12:00:00.000Z', manualTargets: [], useManualTargets: false },
    })

    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(sent.targets).toBeUndefined()
    expect(sent.mode).toBe('site_only')
  })

  it('فشل الخادم → يرمي برسالة عربية', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'لا أهداف مستنتجة' } }),
    })

    await expect(
      saveModSchedule({
        saveUrl: '/api/creator/schedule-projects',
        modId: 'mod-1',
        value: { mode: 'both', datetime: '2026-10-20T12:00:00.000Z', manualTargets: [], useManualTargets: false },
      }),
    ).rejects.toThrow('لا أهداف مستنتجة')
  })
})
