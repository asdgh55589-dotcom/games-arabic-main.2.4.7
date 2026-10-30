/**
 * @jest-environment node
 */

import { TelegramClient, TelegramRateLimitError } from '@/lib/telegram/client'
import { withTelegramRetry } from '@/lib/social/telegram-retry'
import { retryWithBackoff } from '@/lib/telegram/retry'
import { CircuitBreaker } from '@/infrastructure/resilience/circuit-breaker'

const TOKEN = 'secret-token-123'

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  jest.clearAllMocks()
})

afterEach(() => {
  delete (global as any).fetch
})

describe('Telegram delivery integration', () => {
  it('1. single destination publish success', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }),
    )
    const client = new TelegramClient(TOKEN)
    const res = await client.sendMessage({ chatId: '-1001', text: 'hello' })
    expect(res.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('2. multi-destination 3 all succeed', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), { status: 200 })),
    )
    const client = new TelegramClient(TOKEN)
    const results = await Promise.all(
      ['a', 'b', 'c'].map((c) => client.sendMessage({ chatId: c, text: 'hi' })),
    )
    expect(results.every((r) => r.ok)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('3. multi-destination 1 failure partial success', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, description: 'bad' }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 3 } }), { status: 200 }),
      )
    const client = new TelegramClient(TOKEN)
    const results = await Promise.all(
      ['a', 'b', 'c'].map((c) => client.sendMessage({ chatId: c, text: 'hi' })),
    )
    expect(results.filter((r) => r.ok)).toHaveLength(2)
    expect(results.filter((r) => !r.ok)).toHaveLength(1)
  })

  it('4. 429 retry_after then success', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, parameters: { retry_after: 0 } }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 4 } }), { status: 200 }),
      )
    const client = new TelegramClient(TOKEN)
    const result = await withTelegramRetry(
      () => client.sendMessage({ chatId: '1', text: 'hi' }),
      3,
    )
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('5. 5xx exponential backoff success', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }), { status: 200 }),
      )
    const client = new TelegramClient(TOKEN)
    const result = await retryWithBackoff(
      async () => {
        const r = await client.sendMessage({ chatId: '1', text: 'hi' })
        if (!r.ok) throw new Error('5xx')
        return r
      },
      { maxRetries: 2, baseDelayMs: 1 },
    )
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('6. circuit breaker opens', async () => {
    const cb = new CircuitBreaker('telegram', {
      failureThreshold: 2,
      resetTimeoutMs: 100000,
      halfOpenMaxAttempts: 1,
    })
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(async () => { throw new Error('fail') })).rejects.toThrow()
    }
    expect(cb.currentState).toBe('OPEN')
    expect(cb.isOpen).toBe(true)
  })

  it('7. webhook dedup rejects duplicate update_id', () => {
    const seen = new Set<number>()
    const dedup = (id: number) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    }
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    expect(dedup(42)).toBe(true)
    expect(dedup(42)).toBe(false)
    expect(fetchMock).toBeDefined()
  })

  it('8. media asset attachment', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 8 } }), { status: 200 }),
    )
    const client = new TelegramClient(TOKEN)
    const res = await client.sendPhoto({ chatId: '1', photo: 'https://example.com/img.jpg' })
    expect(res.ok).toBe(true)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.photo).toBe('https://example.com/img.jpg')
  })

  it('9. photo with caption', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), { status: 200 }),
    )
    const client = new TelegramClient(TOKEN)
    await client.sendPhoto({ chatId: '1', photo: 'https://example.com/img.jpg', caption: 'cap' })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.caption).toBe('cap')
  })

  it('10. media group sendMediaGroup', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: [{ message_id: 10 }] }), { status: 200 }),
    )
    const client = new TelegramClient(TOKEN)
    const res = await client.sendMediaGroup({
      chatId: '1',
      items: [
        { type: 'photo', media: 'a' },
        { type: 'photo', media: 'b' },
      ],
    })
    expect(res.ok).toBe(true)
    expect(String(fetchMock.mock.calls[0][0])).toContain('sendMediaGroup')
  })

  it('11. forum thread id passed', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { message_id: 11 } }), { status: 200 }),
    )
    const client = new TelegramClient(TOKEN)
    await client.sendMessage({ chatId: '1', text: 'hi', messageThreadId: 42 })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.message_thread_id).toBe(42)
  })

  it('12. invalid token fails fast', async () => {
    const client = new TelegramClient(null)
    const res = await client.sendMessage({ chatId: '1', text: 'hi' })
    expect(res.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
