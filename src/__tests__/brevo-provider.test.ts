/**
 * brevo-provider.test.ts — Brevo SMTP API v3 adapter contract tests.
 *
 * No real emails: global.fetch is mocked in every test. No prod writes.
 * Covers: happy path (URL/auth/payload incl. sender+replyTo), missing key,
 * 401/400/429 no-retry, 500 single retry after 2s, circuit breaker open
 * after 3 failures, daily free-tier cap, secret/recipient hygiene
 * (masked recipients, full key never in logger/reportError args).
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/error-reporting', () => ({
  reportError: jest.fn(() => 'skipped'),
}))

import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { brevoProvider, maskRecipient, resetBrevoCircuit } from '@/lib/email/brevo'

const TEST_KEY = 'xkeysib-testkey1234567890abcdef'
const SEND_URL = 'https://api.brevo.com/v3/smtp/email'

function stubResponse(status: number, body: unknown) {
  return {
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

const baseMsg = {
  from: 'Games Arabic <noreply@games-arabic.com>',
  to: ['abdo@example.com'],
  subject: 'تأكيد بريدك الإلكتروني — GAMES ARABIC',
  html: '<div dir="rtl">مرحباً</div>',
}

describe('brevo provider', () => {
  const OLD = {
    key: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME,
    replyTo: process.env.BREVO_REPLY_TO,
    provider: process.env.EMAIL_PROVIDER,
  }

  beforeEach(() => {
    resetBrevoCircuit()
    jest.clearAllMocks()
    process.env.BREVO_API_KEY = TEST_KEY
    delete process.env.BREVO_SENDER_EMAIL
    delete process.env.BREVO_SENDER_NAME
    delete process.env.BREVO_REPLY_TO
    delete process.env.EMAIL_PROVIDER
    ;(global.fetch as unknown as jest.Mock) = jest.fn()
  })

  afterAll(() => {
    for (const [k, v] of Object.entries(OLD)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('happy path: POSTs documented URL/auth/payload and returns {ok:true}', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(201, { messageId: '<msg-1@smtp-relay>' }))

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: true, providerMessageId: '<msg-1@smtp-relay>' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }]
    expect(url).toBe(SEND_URL)
    expect(init.method).toBe('POST')
    expect(init.headers['api-key']).toBe(TEST_KEY)
    expect(init.headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.sender).toEqual({ name: 'Games Arabic', email: 'noreply@smtp-brevo.com' })
    expect(body.to).toEqual([{ email: 'abdo@example.com' }])
    expect(body).not.toHaveProperty('replyTo')
    expect(body.subject).toBe(baseMsg.subject)
    expect(body.htmlContent).toBe(baseMsg.html)
  })

  it('honors BREVO_SENDER_* overrides and sets replyTo when configured', async () => {
    process.env.BREVO_SENDER_EMAIL = 'news@example.com'
    process.env.BREVO_SENDER_NAME = 'GA News'
    process.env.BREVO_REPLY_TO = 'owner@example.com'
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(201, { messageId: 'm2' }))

    await brevoProvider.send(baseMsg)

    const body = JSON.parse((fetchMock.mock.calls[0][1].body as string)) as Record<string, unknown>
    expect(body.sender).toEqual({ name: 'GA News', email: 'news@example.com' })
    expect(body.replyTo).toEqual({ email: 'owner@example.com', name: 'Games Arabic Support' })
  })

  it('missing key returns not-configured without network', async () => {
    delete process.env.BREVO_API_KEY
    const fetchMock = global.fetch as unknown as jest.Mock

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('401 maps to unauthorized with NO retry', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(401, { message: 'Unauthorized' }))

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('400 maps to validation-error with NO retry', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(400, { message: 'Bad Request' }))

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: false, reason: 'validation-error' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('429 maps to rate-limited with NO retry', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(429, { message: 'Rate limit' }))

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: false, reason: 'rate-limited' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('500 retries exactly once after ~2s then reports server-error', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(500, { message: 'boom' }))

    const started = Date.now()
    const result = await brevoProvider.send(baseMsg)
    const elapsed = Date.now() - started

    expect(result).toEqual({ ok: false, reason: 'server-error' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(elapsed).toBeGreaterThanOrEqual(1900)
    expect(reportError).toHaveBeenCalled()
  })

  it('network rejection maps to network-error with NO retry', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockRejectedValue(new Error('socket hang up'))

    const result = await brevoProvider.send(baseMsg)

    expect(result).toEqual({ ok: false, reason: 'network-error' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('circuit opens after 3 consecutive failures and short-circuits the 4th', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(500, { message: 'boom' }))

    await brevoProvider.send(baseMsg)
    await brevoProvider.send(baseMsg)
    const third = await brevoProvider.send(baseMsg)
    expect(third).toEqual({ ok: false, reason: 'server-error' })
    expect(fetchMock).toHaveBeenCalledTimes(6) // 3 sends × (1 + 1 retry)

    const shortCircuited = await brevoProvider.send(baseMsg)
    expect(shortCircuited).toEqual({ ok: false, reason: 'circuit-open' })
    expect(fetchMock).toHaveBeenCalledTimes(6) // no new network call
  }, 15000)

  it('masks recipients in logs and never leaks the full key', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(201, { messageId: 'm3' }))

    await brevoProvider.send(baseMsg)

    const infoMock = logger.info as unknown as jest.Mock
    const loggedTo = infoMock.mock.calls[0][1].to as string[]
    expect(loggedTo).toEqual(['ab***@example.com'])
    const allLoggerArgs = JSON.stringify([
      ...(logger.info as unknown as jest.Mock).mock.calls,
      ...(logger.warn as unknown as jest.Mock).mock.calls,
    ])
    expect(allLoggerArgs).not.toContain('abdo@example.com')
    expect(allLoggerArgs).not.toContain(TEST_KEY)
    const reportArgs = JSON.stringify((reportError as unknown as jest.Mock).mock.calls)
    expect(reportArgs).not.toContain(TEST_KEY)
  })

  it('maskRecipient helper degrades safely', () => {
    expect(maskRecipient('abdo@example.com')).toBe('ab***@example.com')
    expect(maskRecipient('a@x.io')).toBe('a***@x.io')
    expect(maskRecipient('not-an-email')).toBe('***')
    expect(maskRecipient('')).toBe('***')
  })

  it('daily free-tier cap refuses past 300 sends in a UTC day', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(201, { messageId: 'bulk' }))

    let last: { ok: boolean; reason?: string } = { ok: true }
    // Loop until capped (prior tests in this file already consumed quota
    // on the same day-key, so a fixed count would be order-dependent).
    for (let i = 0; i < 320; i++) {
      last = await brevoProvider.send({ ...baseMsg, to: [`u${i}@example.com`] })
      if (!last.ok) break
    }
    expect(last).toEqual({ ok: false, reason: 'daily-limit' })
    // Warn-on-approach fired while climbing through 250.
    const warnCalls = (logger.warn as unknown as jest.Mock).mock.calls
    expect(
      warnCalls.some((c) => (c[0] as Record<string, unknown>)?.event === 'brevo_daily_warn'),
    ).toBe(true)
  }, 60000)
})
