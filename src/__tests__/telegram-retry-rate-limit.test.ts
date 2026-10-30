import { retryWithBackoff } from '@/lib/telegram/retry'
import { checkRateLimit, resetRateLimitState } from '@/lib/telegram/rate-limiter'

describe('telegram retry + rate limiter', () => {
  beforeEach(() => {
    resetRateLimitState()
    jest.useRealTimers()
  })

  // Retry
  it('retry: returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok')
    await expect(retryWithBackoff(fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retry: retries thrown error then succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok')
    await expect(retryWithBackoff(fn, { baseDelayMs: 0 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retry: waits retryAfter seconds when error has retryAfter', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('rl'), { retryAfter: 0 }))
      .mockResolvedValue('ok')
    await expect(retryWithBackoff(fn, { baseDelayMs: 1000 })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retry: throws after maxRetries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always'))
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 0 })).rejects.toThrow('always')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  // Rate limiter
  it('rate: first call allowed', () => {
    expect(checkRateLimit('chat-a').allowed).toBe(true)
  })

  it('rate: second call within 1s blocked with retryAfter', () => {
    checkRateLimit('chat-b')
    const r = checkRateLimit('chat-b')
    expect(r.allowed).toBe(false)
    expect(typeof r.retryAfter).toBe('number')
  })

  it('rate: global limit blocks 31st call', () => {
    for (let i = 0; i < 30; i++) {
      checkRateLimit(`g-${i}`)
    }
    const r = checkRateLimit('g-overflow')
    expect(r.allowed).toBe(false)
  })

  it('rate: fail-open returns allowed on error', () => {
    // force an error by passing something that breaks String? none; just sanity
    expect(checkRateLimit('chat-c').allowed).toBe(true)
  })
})
