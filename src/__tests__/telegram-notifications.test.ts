/**
 * Telegram-first P1: notification service + templates.
 *
 * Abuse cases first: malicious display names must not break Telegram HTML;
 * a dead/misconfigured bot must never block auth (fail-open); chat targets
 * must be numeric IDs (never usernames).
 */
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'

const mockSendMessage = jest.fn()
jest.mock('@/lib/telegram-bot', () => ({
  sendMessage: (...a: Array<never>) => mockSendMessage(...a),
}))

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

import {
  escapeTelegramHtml,
  hasTelegramBot,
  isValidChatId,
  sendTelegramNotification,
} from '@/lib/telegram-notifications'
import {
  maskEmail,
  maskIp,
  newLoginAlert,
  passwordChangedMessage,
  passwordResetMessage,
  welcomeMessage,
} from '@/lib/telegram-templates'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  mockSendMessage.mockResolvedValue({ ok: true })
})

describe('sendTelegramNotification', () => {
  it('sends HTML messages to numeric chat IDs', async () => {
    const out = await sendTelegramNotification({ chatId: 12345, text: '<b>hi</b>' })
    expect(out).toEqual({ ok: true })
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '12345', text: '<b>hi</b>', parseMode: 'HTML' }),
    )
  })

  it('resolves fail-open without a bot token (never throws)', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    expect(hasTelegramBot()).toBe(false)
    const out = await sendTelegramNotification({ chatId: 1, text: 'x' })
    expect(out.ok).toBe(false)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('rejects non-numeric chat targets without calling the API', async () => {
    expect(isValidChatId('some_username')).toBe(false)
    expect(isValidChatId('123abc')).toBe(false)
    expect(isValidChatId(998877)).toBe(true)
    expect(isValidChatId('998877')).toBe(true)
    const out = await sendTelegramNotification({ chatId: '@username', text: 'x' })
    expect(out.ok).toBe(false)
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('treats API errors (429/blocked) as advisory fail-open', async () => {
    mockSendMessage.mockResolvedValue({ ok: false, description: 'Too Many Requests', error_code: 429 })
    const out = await sendTelegramNotification({ chatId: 1, text: 'x' })
    expect(out).toEqual({ ok: false, error: 'Too Many Requests' })
  })

  it('passes inline buttons through', async () => {
    const kb = { inline_keyboard: [[{ text: 'a', url: 'https://x/y' }]] }
    await sendTelegramNotification({ chatId: 1, text: 'x', replyMarkup: kb })
    expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({ replyMarkup: kb }))
  })
})

describe('templates', () => {
  it('escapes hostile display names', () => {
    const evil = '<b>hacker</b><a href="https://evil">x</a>'
    const msg = welcomeMessage(evil)
    expect(msg.text).not.toContain('<a href="https://evil">')
    expect(msg.text).toContain(escapeTelegramHtml(evil))
    expect(escapeTelegramHtml('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d')
  })

  it('masks PII in alerts', () => {
    expect(maskEmail('ab12@mail.com')).toBe('ab***@mail.com')
    expect(maskIp('1.2.3.4')).toBe('1.2.***.***')
    expect(maskIp(null)).toBe('غير معروف')
    const login = newLoginAlert({
      displayName: 'u', device: 'هاتف', ip: '9.9.9.9', secureUrl: 'https://x/s',
    })
    expect(login.text).toContain('9.9.***.***')
    expect(login.replyMarkup).toBeDefined()
  })

  it('reset carries the button link; changed carries no secret', () => {
    const reset = passwordResetMessage('u', 'https://site/reset-password?token=abc')
    expect(JSON.stringify(reset.replyMarkup)).toContain('https://site/reset-password?token=abc')
    const changed = passwordChangedMessage({ displayName: 'u', ip: '1.1.1.1' })
    expect(changed.text).toContain('تم تغيير كلمة المرور')
    expect(changed.replyMarkup).toBeUndefined()
  })

  it('all templates are Arabic', () => {
    const bodies = [
      welcomeMessage('u').text,
      passwordResetMessage('u', 'https://x').text,
      passwordChangedMessage({ displayName: 'u' }).text,
      newLoginAlert({ displayName: 'u', device: 'd', secureUrl: 'https://x' }).text,
    ]
    for (const b of bodies) {
      expect(b).toMatch(/[\u0600-\u06FF]/)
    }
  })
})
