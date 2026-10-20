/**
 * اختبارات حلّ البوت والخنق (المرحلة 3).
 * الترتيب: هدف صريح ← وجهة ← env. التوكن لا يظهر في الأخطاء أبداً.
 */

jest.mock('@/lib/db', () => ({
  db: { socialTelegramBot: { findUnique: jest.fn() } },
}))

jest.mock('@/lib/social/bot-token', () => ({
  decryptBotToken: jest.fn((enc: string) => {
    if (enc === 'good-enc') return 'live-token-value'
    throw new Error('malformed social bot token envelope')
  }),
}))

import { db } from '@/lib/db'
import {
  botTokenFingerprint,
  resetBotThrottleForTests,
  resolveTargetBot,
  throttleBotSend,
} from '../bot-resolve'

const mockBotFind = db.socialTelegramBot.findUnique as jest.Mock

const OLD_ENV = { ...process.env }

beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV }
  delete process.env.TELEGRAM_BOT_TOKEN
  resetBotThrottleForTests()
})

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('resolveTargetBot — الترتيب', () => {
  it('بوت الهدف الصريح أولاً', async () => {
    mockBotFind.mockResolvedValueOnce({ id: 'bt', status: 'active', tokenEnc: 'good-enc' })

    const r = await resolveTargetBot({ targetBotId: 'bt', destinationBotId: 'bd' })

    expect(r).toMatchObject({ ok: true, source: 'target', botId: 'bt', token: 'live-token-value' })
    expect(mockBotFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bt' } }))
  })

  it('بوت الوجهة عند غياب إسناد الهدف', async () => {
    mockBotFind.mockResolvedValueOnce({ id: 'bd', status: 'active', tokenEnc: 'good-enc' })

    const r = await resolveTargetBot({ targetBotId: null, destinationBotId: 'bd' })

    expect(r).toMatchObject({ ok: true, source: 'destination', botId: 'bd' })
  })

  it('env عند غياب أي إسناد', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env-tok'

    const r = await resolveTargetBot({})

    expect(r).toMatchObject({ ok: true, source: 'env', botId: null, token: 'env-tok' })
    expect(mockBotFind).not.toHaveBeenCalled()
  })

  it('بوت مجهول/معطل/تالف → خطأ عربي بلا توكن', async () => {
    mockBotFind.mockResolvedValueOnce(null)
    const missing = await resolveTargetBot({ targetBotId: 'ghost' })
    expect(missing.ok).toBe(false)

    mockBotFind.mockResolvedValueOnce({ id: 'b', status: 'disabled', tokenEnc: 'good-enc' })
    const disabled = await resolveTargetBot({ targetBotId: 'b' })
    expect(disabled.ok).toBe(false)
    expect(disabled.error).toMatch(/غير نشط/)

    mockBotFind.mockResolvedValueOnce({ id: 'b', status: 'active', tokenEnc: 'bad-enc' })
    const corrupt = await resolveTargetBot({ targetBotId: 'b' })
    expect(corrupt.ok).toBe(false)

    const naked = await resolveTargetBot({})
    expect(naked.ok).toBe(false)
    expect(naked.error).toMatch(/أسند بوتاً/)

    for (const r of [missing, disabled, corrupt, naked]) {
      expect(JSON.stringify(r)).not.toContain('live-token-value')
      expect(JSON.stringify(r)).not.toContain('env-tok')
    }
  })
})

describe('throttleBotSend + fingerprint', () => {
  it('البصمة ثابتة ولا تحوي التوكن', () => {
    const a = botTokenFingerprint('live-token-value')
    const b = botTokenFingerprint('live-token-value')
    expect(a).toBe(b)
    expect(a).not.toContain('live-token-value')
    expect(botTokenFingerprint('other')).not.toBe(a)
  })

  it('الإرسال الثاني الفوري ينتظر التباعد', async () => {
    const start = Date.now()
    await throttleBotSend('fp1', 40)
    await throttleBotSend('fp1', 40)
    expect(Date.now() - start).toBeGreaterThanOrEqual(25)
  })

  it('بوتات مختلفة لا تحجب بعضها', async () => {
    const start = Date.now()
    await throttleBotSend('fp-a', 500)
    await throttleBotSend('fp-b', 500)
    // الثانية لا تنتظر الأولى (مفتاح مختلف) — أقل بكثير من 500ms.
    expect(Date.now() - start).toBeLessThan(400)
  })
})
