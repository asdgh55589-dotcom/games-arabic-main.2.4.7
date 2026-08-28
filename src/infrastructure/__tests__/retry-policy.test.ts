import { RetryPolicy } from '../resilience/retry-policy'

describe('RetryPolicy', () => {
  describe('calculateDelay', () => {
    it('should calculate exponential backoff', () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterMs: 0,
      })

      const delay0 = policy.calculateDelay(0)
      const delay1 = policy.calculateDelay(1)
      const delay2 = policy.calculateDelay(2)

      expect(delay0).toBe(100)
      expect(delay1).toBe(200)
      expect(delay2).toBe(400)
    })

    it('should cap at maxDelayMs', () => {
      const policy = new RetryPolicy({
        maxAttempts: 10,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        jitterMs: 0,
      })

      const delay = policy.calculateDelay(10)
      expect(delay).toBeLessThanOrEqual(5000)
    })

    it('should add jitter', () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterMs: 50,
      })

      const delay = policy.calculateDelay(0)
      expect(delay).toBeGreaterThanOrEqual(100)
      expect(delay).toBeLessThanOrEqual(150)
    })
  })

  describe('shouldRetry', () => {
    it('should return false when maxAttempts reached', () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterMs: 0,
      })

      expect(policy.shouldRetry(new Error('fail'), 3)).toBe(false)
    })

    it('should return true when under maxAttempts', () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterMs: 0,
      })

      expect(policy.shouldRetry(new Error('fail'), 1)).toBe(true)
    })

    it('should use custom shouldRetry', () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 10000,
        jitterMs: 0,
        shouldRetry: (error) => {
          return error instanceof Error && error.message !== 'permanent'
        },
      })

      expect(policy.shouldRetry(new Error('transient'), 1)).toBe(true)
      expect(policy.shouldRetry(new Error('permanent'), 1)).toBe(false)
    })
  })

  describe('execute', () => {
    it('should return result on success', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterMs: 0,
      })

      const result = await policy.execute(async () => 'ok')
      expect(result).toBe('ok')
    })

    it('should retry on failure and succeed', async () => {
      let attempts = 0
      const policy = new RetryPolicy({
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterMs: 0,
      })

      const result = await policy.execute(async () => {
        attempts++
        if (attempts < 3) throw new Error('fail')
        return 'ok'
      })

      expect(result).toBe('ok')
      expect(attempts).toBe(3)
    })

    it('should throw after all retries fail', async () => {
      const policy = new RetryPolicy({
        maxAttempts: 2,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterMs: 0,
      })

      await expect(
        policy.execute(async () => {
          throw new Error('always fail')
        })
      ).rejects.toThrow('always fail')
    })
  })
})
