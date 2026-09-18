/**
 * email-provider-select.test.ts — transport selector routing.
 *
 * Static only: provider modules are mocked, so no network and no keys.
 * Covers: forced brevo/emitlo honored strictly, auto prefers Brevo,
 * Emitlo fallback, dev-log fallback with no keys, and the sendEmail
 * success/error adapter shape.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const mockBrevoSend = jest.fn()
const mockEmitloSend = jest.fn()
jest.mock('@/lib/email/brevo', () => ({
  brevoProvider: { send: (...a: Array<never>) => mockBrevoSend(...a) },
}))
jest.mock('@/lib/email/emitlo', () => ({
  emitloProvider: { send: (...a: Array<never>) => mockEmitloSend(...a) },
}))

import { emailProvider, resolveEmailProvider, sendEmail } from '@/lib/email'

const KEYS = [
  'EMAIL_PROVIDER',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
  'BREVO_REPLY_TO',
  'EMITLO_API_KEY',
] as const

describe('resolveEmailProvider', () => {
  const OLD: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of KEYS) {
      OLD[k] = process.env[k]
      delete process.env[k]
    }
  })

  afterAll(() => {
    for (const k of KEYS) {
      if (OLD[k] === undefined) delete process.env[k]
      else process.env[k] = OLD[k] as string
    }
  })

  it('auto prefers Brevo when its key exists', () => {
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    process.env.EMITLO_API_KEY = 'em-abc'
    expect(resolveEmailProvider()).toBe('brevo')
  })

  it('auto falls back to Emitlo when only its key exists', () => {
    process.env.EMITLO_API_KEY = 'em-abc'
    expect(resolveEmailProvider()).toBe('emitlo')
  })

  it('auto reports none when no keys exist', () => {
    expect(resolveEmailProvider()).toBe('none')
  })

  it('forced brevo wins even with both keys', () => {
    process.env.EMAIL_PROVIDER = 'brevo'
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    process.env.EMITLO_API_KEY = 'em-abc'
    expect(resolveEmailProvider()).toBe('brevo')
  })

  it('forced emitlo wins even with both keys', () => {
    process.env.EMAIL_PROVIDER = 'emitlo'
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    process.env.EMITLO_API_KEY = 'em-abc'
    expect(resolveEmailProvider()).toBe('emitlo')
  })
})

describe('emailProvider routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.EMAIL_PROVIDER
    delete process.env.BREVO_API_KEY
    delete process.env.EMITLO_API_KEY
  })

  const msg = {
    from: 'Games Arabic <noreply@games-arabic.com>',
    to: ['u@example.com'],
    subject: 's',
    html: '<p>hi</p>',
  }

  it('routes to Brevo when its key exists', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    process.env.EMITLO_API_KEY = 'em-abc'
    mockBrevoSend.mockResolvedValue({ ok: true, providerMessageId: 'b1' })

    const result = await emailProvider.send(msg)

    expect(mockBrevoSend).toHaveBeenCalledTimes(1)
    expect(mockEmitloSend).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, providerMessageId: 'b1' })
  })

  it('routes to Emitlo when only its key exists', async () => {
    process.env.EMITLO_API_KEY = 'em-abc'
    mockEmitloSend.mockResolvedValue({ ok: true })

    const result = await emailProvider.send(msg)

    expect(mockEmitloSend).toHaveBeenCalledTimes(1)
    expect(mockBrevoSend).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('falls back to dev-log without network when no keys exist', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const result = await emailProvider.send(msg)
      expect(result).toEqual({ ok: false, reason: 'not-configured' })
      expect(mockBrevoSend).not.toHaveBeenCalled()
      expect(mockEmitloSend).not.toHaveBeenCalled()
    } finally {
      logSpy.mockRestore()
    }
  })
})

describe('sendEmail adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.EMAIL_PROVIDER
    delete process.env.EMITLO_API_KEY
  })

  it('maps provider success to {success:true, messageId}', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    mockBrevoSend.mockResolvedValue({ ok: true, providerMessageId: 'b9' })

    await expect(
      sendEmail({ to: ['u@example.com'], subject: 's', html: '<p>hi</p>' }),
    ).resolves.toEqual({ success: true, messageId: 'b9' })
  })

  it('maps provider failure to {success:false, error}', async () => {
    process.env.BREVO_API_KEY = 'xkeysib-abc'
    mockBrevoSend.mockResolvedValue({ ok: false, reason: 'unauthorized' })

    await expect(
      sendEmail({ to: ['u@example.com'], subject: 's', html: '<p>hi</p>' }),
    ).resolves.toEqual({ success: false, error: 'unauthorized' })
  })
})
