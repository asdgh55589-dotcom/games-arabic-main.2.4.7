/**
 * Telegram-first P2-P5: routing matrix, Telegram recover, numeric identity.
 *
 * - telegram user + critical event → bot (+ verified-inbox email backup)
 * - unverified inbox + reset link → bot ONLY (no link leak)
 * - email-only user → email only, telegram untouched
 * - unknown user → silent {false,false}
 * - login alerts fire on IP change, stay silent on same IP
 * - Telegram username change keeps the numeric-linked account
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockUserFindUnique = jest.fn()
const mockOAuthFindFirst = jest.fn()
const mockSessionFindMany = jest.fn()
jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: Array<never>) => mockUserFindUnique(...a) },
    oAuthAccount: { findFirst: (...a: Array<never>) => mockOAuthFindFirst(...a) },
    session: { findMany: (...a: Array<never>) => mockSessionFindMany(...a) },
  },
}))

const mockTgSend = jest.fn()
jest.mock('@/lib/telegram-notifications', () => ({
  sendTelegramNotification: (...a: Array<never>) => mockTgSend(...a),
  // Inline mirrors of the pure helpers (requireActual would load the
  // ESM-only cockatiel chain via telegram-bot; reals covered elsewhere).
  isValidChatId: (chatId: unknown) =>
    typeof chatId === 'number'
      ? Number.isFinite(chatId)
      : typeof chatId === 'string' && /^\d+$/.test(chatId.trim()),
  escapeTelegramHtml: (raw: string) =>
    String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  urlButton: (text: string, url: string) => ({ inline_keyboard: [[{ text, url }]] }),
}))

const mockSendChanged = jest.fn()
jest.mock('@/lib/password-changed-email', () => ({
  sendPasswordChangedEmail: (...a: Array<never>) => mockSendChanged(...a),
}))

const mockSendReset = jest.fn()
jest.mock('@/lib/recovery-email', () => ({
  sendPasswordResetEmail: (...a: Array<never>) => mockSendReset(...a),
}))

import { maybeSendLoginAlert, routeNotification } from '@/lib/notification-router'

const TG_USER = {
  username: 'tguser',
  displayName: 'Tg User',
  email: 'telegram_5@telegram.local',
  emailVerified: false,
}
const TG_VERIFIED = { ...TG_USER, email: 'real@mail.com', emailVerified: true }
const EMAIL_USER = {
  username: 'mailuser',
  displayName: null,
  email: 'mail@mail.com',
  emailVerified: false,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockTgSend.mockResolvedValue({ ok: true })
  mockSendChanged.mockResolvedValue(true)
  mockSendReset.mockResolvedValue(true)
  mockSessionFindMany.mockResolvedValue([])
})

function linkAs(chatId: string | null) {
  mockOAuthFindFirst.mockResolvedValue(chatId ? { providerAccountId: chatId } : null)
}

describe('routeNotification matrix', () => {
  it('telegram user + password_changed → bot (+ verified-inbox email backup)', async () => {
    mockUserFindUnique.mockResolvedValue(TG_VERIFIED)
    linkAs('555')
    const out = await routeNotification({ userId: 'u-1', type: 'password_changed', data: {} })
    expect(out).toEqual({ telegram: true, email: true })
    expect(mockTgSend).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '555' }),
    )
    expect(mockSendChanged).toHaveBeenCalledWith('real@mail.com', expect.anything())
  })

  it('telegram user + unverified inbox + reset → bot ONLY (no link leak)', async () => {
    mockUserFindUnique.mockResolvedValue(TG_USER)
    linkAs('555')
    const out = await routeNotification({
      userId: 'u-1',
      type: 'password_reset',
      data: { resetUrl: 'https://x/reset-password?token=abc' },
    })
    expect(out).toEqual({ telegram: true, email: false })
    expect(mockSendReset).not.toHaveBeenCalled()
  })

  it('email-only user + password_changed → email only', async () => {
    mockUserFindUnique.mockResolvedValue(EMAIL_USER)
    linkAs(null)
    const out = await routeNotification({ userId: 'u-1', type: 'password_changed', data: {} })
    expect(out).toEqual({ telegram: false, email: true })
    expect(mockTgSend).not.toHaveBeenCalled()
    expect(mockSendChanged).toHaveBeenCalledWith('mail@mail.com', expect.anything())
  })

  it('unknown user → silent no-op', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const out = await routeNotification({ userId: 'u-nope', type: 'recovery', data: {} })
    expect(out).toEqual({ telegram: false, email: false })
    expect(mockTgSend).not.toHaveBeenCalled()
  })

  it('non-numeric providerAccountId is not a chat target', async () => {
    mockUserFindUnique.mockResolvedValue(TG_USER)
    linkAs('not-a-number')
    const out = await routeNotification({ userId: 'u-1', type: 'recovery', data: {} })
    expect(out.telegram).toBe(false)
    expect(mockTgSend).not.toHaveBeenCalled()
  })
})

describe('maybeSendLoginAlert', () => {
  function tgLinked() {
    mockUserFindUnique.mockResolvedValue(TG_USER)
    linkAs('555')
  }

  it('alerts on IP change', async () => {
    tgLinked()
    mockSessionFindMany.mockResolvedValue([
      { token: 'cur', ipAddress: '9.9.9.9' },
      { token: 'old', ipAddress: '1.1.1.1' },
    ])
    await maybeSendLoginAlert('u-1', { ip: '9.9.9.9', userAgent: 'UA', currentToken: 'cur' })
    expect(mockTgSend).toHaveBeenCalled()
  })

  it('stays silent on same IP', async () => {
    tgLinked()
    mockSessionFindMany.mockResolvedValue([
      { token: 'cur', ipAddress: '1.1.1.1' },
      { token: 'old', ipAddress: '1.1.1.1' },
    ])
    await maybeSendLoginAlert('u-1', { ip: '1.1.1.1', userAgent: 'UA', currentToken: 'cur' })
    expect(mockTgSend).not.toHaveBeenCalled()
  })

  it('alerts on first-ever session (no history)', async () => {
    tgLinked()
    mockSessionFindMany.mockResolvedValue([{ token: 'cur', ipAddress: '9.9.9.9' }])
    await maybeSendLoginAlert('u-1', { ip: '9.9.9.9', userAgent: 'UA', currentToken: 'cur' })
    expect(mockTgSend).toHaveBeenCalled()
  })

  it('never alerts email-only users', async () => {
    mockUserFindUnique.mockResolvedValue(EMAIL_USER)
    linkAs(null)
    await maybeSendLoginAlert('u-1', { ip: '9.9.9.9', userAgent: 'UA', currentToken: 'cur' })
    expect(mockTgSend).not.toHaveBeenCalled()
  })
})

describe('call-site wiring invariants', () => {
  const src = (p: string) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:path').join(__dirname, '..', p),
      'utf8',
    ) as string

  it('password + MFA routes fan out through the router', () => {
    expect(src('app/api/auth/change-password/route.ts')).toContain("type: 'password_changed'")
    expect(src('app/api/auth/reset-password/route.ts')).toContain("type: 'password_changed'")
    expect(src('app/api/auth/mfa/verify/route.ts')).toContain("type: 'mfa_change'")
    expect(src('app/api/auth/mfa/disable/route.ts')).toContain("type: 'mfa_change'")
    expect(src('app/api/auth/verify-email/route.ts')).toContain("type: 'email_change'")
  })

  it('all three login paths emit new-device alerts', () => {
    expect(src('app/api/auth/login-identifier/route.ts')).toContain('maybeSendLoginAlert')
    expect(src('app/api/auth/login/route.ts')).toContain('maybeSendLoginAlert')
    expect(src('lib/telegram-login.ts')).toContain('maybeSendLoginAlert')
  })

  it('recover mints tokens for linked Telegram users (not just email)', () => {
    const recover = src('app/api/auth/recover/route.ts')
    expect(recover).toContain('telegramUserId')
    expect(recover).toContain("type: 'password_reset'")
  })
})
