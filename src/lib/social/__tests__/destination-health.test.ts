/**
 * اختبارات lib/social/destination-health — تسلسل getMe/getChat/getChatMember.
 *
 * التوكن يظهر في عنوان الطلب فقط (تصميم Bot API نفسه) — ولا يظهر أبداً
 * في أي نتيجة أو رسالة خطأ. هذه الخاصية مُثبتة هنا صراحةً.
 */

import { checkDestinationHealth } from '../destination-health'

const SECRET = 'live-bot-token-must-never-leak'

function botApiResponse(result: unknown) {
  return {
    ok: true,
    json: async () => ({ ok: true, result }),
  } as Response
}

function botApiFailure(description: string) {
  return {
    ok: true,
    json: async () => ({ ok: false, description }),
  } as Response
}

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
})

const ME = { id: 777001, is_bot: true, username: 'testbot' }
const CHAT = { id: -100111, type: 'supergroup', title: 'مجموعة', username: 'grp' }

describe('checkDestinationHealth', () => {
  it('المسار السعيد: مشرف يستطيع النشر + خريطة المحادثة', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(botApiResponse(ME))
      .mockResolvedValueOnce(botApiResponse(CHAT))
      .mockResolvedValueOnce(botApiResponse({ status: 'administrator' }))

    const r = await checkDestinationHealth({ chatId: '-100111', botToken: SECRET })

    expect(r).toEqual({
      ok: true,
      memberStatus: 'administrator',
      canPost: true,
      chat: { id: -100111, type: 'supergroup', title: 'مجموعة', username: 'grp' },
    })
  })

  it('مطرود → canPost:false مع سبب عربي', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce(botApiResponse(ME))
      .mockResolvedValueOnce(botApiResponse(CHAT))
      .mockResolvedValueOnce(botApiResponse({ status: 'kicked' }))

    const r = await checkDestinationHealth({ chatId: '-100111', botToken: SECRET })

    expect(r.ok).toBe(false)
    expect(r.canPost).toBe(false)
    expect(r.memberStatus).toBe('kicked')
    expect(r.error).toMatch(/مطرود/)
  })

  it('getMe فاشل → خطأ توكن بلا تسريب', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(botApiFailure('Unauthorized'))

    const r = await checkDestinationHealth({ chatId: '-100111', botToken: SECRET })

    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/توكن البوت غير صالح/)
    expect(JSON.stringify(r)).not.toContain(SECRET)
  })

  it('عطل شبكة → رسالة عربية، ولا يرمي', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('fetch failed'))

    const r = await checkDestinationHealth({ chatId: '-100111', botToken: SECRET })

    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/الشبكة/)
    expect(JSON.stringify(r)).not.toContain(SECRET)
  })

  it('بلا توكن → رفض فوري', async () => {
    const r = await checkDestinationHealth({ chatId: '-100111', botToken: '' })
    expect(r.ok).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
