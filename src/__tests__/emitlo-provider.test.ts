/**
 * emitlo-provider.test.ts (SA-1) — Emitlo REST adapter contract tests.
 *
 * No real emails: global.fetch is mocked in every test. No prod writes.
 * Covers: happy path (URL/auth/payload), missing key, 401/429 no-retry,
 * 500 single retry, timeout abort, circuit breaker open + half-open
 * recovery, secret hygiene (full key never in logger/reportError args),
 * and the supabase.auth.resend call sites remaining untouched.
 */

import * as fs from 'fs'
import * as path from 'path'

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('@/lib/error-reporting', () => ({
  reportError: jest.fn(() => 'skipped'),
}))

import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'
import { emitloProvider, resetEmitloCircuit } from '@/lib/email/emitlo'

const TEST_KEY = 'ek_live_testkey1234567890'
const SEND_URL = 'https://api.emitlo.com/api/v1/messages'

function stubResponse(status: number, body: unknown) {
  return {
    status,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

function successBody(id = 'msg_test_123') {
  return { status: 'success', data: { message_id: id } }
}

describe('emitlo provider', () => {
  const OLD_KEY = process.env.EMITLO_API_KEY
  const OLD_URL = process.env.EMITLO_API_URL
  const OLD_TIMEOUT = process.env.EMITLO_TIMEOUT_MS

  beforeEach(() => {
    resetEmitloCircuit()
    jest.clearAllMocks()
    process.env.EMITLO_API_KEY = TEST_KEY
    delete process.env.EMITLO_API_URL
    process.env.EMITLO_TIMEOUT_MS = '50'
    ;(global.fetch as unknown as jest.Mock) = jest.fn()
  })

  afterAll(() => {
    if (OLD_KEY === undefined) delete process.env.EMITLO_API_KEY
    else process.env.EMITLO_API_KEY = OLD_KEY
    if (OLD_URL === undefined) delete process.env.EMITLO_API_URL
    else process.env.EMITLO_API_URL = OLD_URL
    if (OLD_TIMEOUT === undefined) delete process.env.EMITLO_TIMEOUT_MS
    else process.env.EMITLO_TIMEOUT_MS = OLD_TIMEOUT
  })

  it('happy path: POSTs documented URL/auth/payload and returns {ok:true}', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(stubResponse(202, successBody('msg_abc')))

    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 'مرحبا',
      html: '<p>مرحبا</p>',
      text: 'مرحبا',
    })

    expect(result).toEqual({ ok: true, providerMessageId: 'msg_abc' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe(SEND_URL)
    expect((opts.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_KEY}`)
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body as string)).toEqual({
      from_email: 'noreply@games-arabic.com',
      to_email: 'user@example.com',
      subject: 'مرحبا',
      body: '<p>مرحبا</p>',
    })
  })

  it('missing key: {ok:false} with no fetch and no throw', async () => {
    delete process.env.EMITLO_API_KEY
    const fetchMock = global.fetch as unknown as jest.Mock

    // send() is fail-open by contract: awaiting must resolve, never reject.
    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })
    expect(result).toEqual({ ok: false, reason: 'not-configured' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('401: no retry (single fetch) and no reportError', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(
      stubResponse(401, { status: 'error', error: { code: 'UNAUTHENTICATED' } }),
    )

    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })

    expect(result).toEqual({ ok: false, reason: 'unauthorized' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('429: no retry and {ok:false}', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(
      stubResponse(429, { status: 'error', error: { code: 'RATE_LIMITED' } }),
    )

    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })

    expect(result).toEqual({ ok: false, reason: 'rate-limited' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('500: exactly 1 retry then {ok:false}', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(
      stubResponse(500, { status: 'error', error: { code: 'INTERNAL_ERROR' } }),
    )

    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })

    expect(result).toEqual({ ok: false, reason: 'server-error' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalled()
  })

  it('timeout: aborts and returns {ok:false}', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockImplementation(
      (_url: unknown, opts?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const sig = opts?.signal
          const onAbort = () => {
            const err = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          }
          if (sig?.aborted) {
            onAbort()
            return
          }
          sig?.addEventListener('abort', onAbort, { once: true })
        }),
    )

    const result = await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })

    expect(result).toEqual({ ok: false, reason: 'timeout' })
    // 1 initial attempt + 1 retry, both aborted
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalled()
  })

  it('circuit breaker opens after 5 consecutive failures, half-open recovers', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(
      stubResponse(500, { status: 'error', error: { code: 'INTERNAL_ERROR' } }),
    )
    const msg = {
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    }

    for (let i = 0; i < 5; i += 1) {
      const r = await emitloProvider.send(msg)
      expect(r.ok).toBe(false)
    }
    const callsAfterFive = fetchMock.mock.calls.length
    expect(callsAfterFive).toBe(10) // 5 sends × (1 + 1 retry)

    // 6th send: circuit open, no fetch
    const open = await emitloProvider.send(msg)
    expect(open).toEqual({ ok: false, reason: 'circuit-open' })
    expect(fetchMock.mock.calls.length).toBe(callsAfterFive)

    // Half-open after 60s: trial send succeeds and circuit recovers
    const realNow = Date.now()
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 61_000)
    try {
      fetchMock.mockResolvedValue(stubResponse(202, successBody('msg_recovered')))
      const recovered = await emitloProvider.send(msg)
      expect(recovered).toEqual({ ok: true, providerMessageId: 'msg_recovered' })
      expect(fetchMock.mock.calls.length).toBe(callsAfterFive + 1)

      // Subsequent sends flow normally (circuit closed)
      fetchMock.mockResolvedValue(stubResponse(202, successBody('msg_next')))
      const next = await emitloProvider.send(msg)
      expect(next.ok).toBe(true)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('never leaks the full API key into logger/reportError calls', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValue(
      stubResponse(500, { status: 'error', error: { code: 'INTERNAL_ERROR' } }),
    )
    await emitloProvider.send({
      from: 'noreply@games-arabic.com',
      to: ['user@example.com'],
      subject: 's',
      html: '<p>x</p>',
    })

    const logged = [
      ...(logger.info as unknown as jest.Mock).mock.calls,
      ...(logger.warn as unknown as jest.Mock).mock.calls,
      ...(logger.error as unknown as jest.Mock).mock.calls,
      ...(reportError as unknown as jest.Mock).mock.calls,
    ]
    expect(logged.length).toBeGreaterThan(0)
    for (const call of logged) {
      expect(JSON.stringify(call)).not.toContain(TEST_KEY)
    }
  })

  it('supabase auth.resend call sites are untouched', () => {
    const files = [
      '../app/api/auth/send-verification-email/route.ts',
      '../components/official-login/login-form.tsx',
      '../views/verify-email.tsx',
    ]
    for (const rel of files) {
      const content = fs.readFileSync(path.join(__dirname, rel), 'utf8')
      expect(content).toContain('supabase.auth.resend')
    }
  })
})
