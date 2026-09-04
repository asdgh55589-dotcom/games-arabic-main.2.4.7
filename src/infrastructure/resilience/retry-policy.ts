/**
 * RetryPolicy — سياسة إعادة المحاولة
 * Exponential backoff with jitter for transient failures.
 */

export interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitterMs: number
  shouldRetry?: (error: unknown) => boolean
}

export class RetryPolicy {
  constructor(private readonly options: RetryOptions) {}

  calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelayMs * Math.pow(2, attempt)
    const jitter = Math.random() * this.options.jitterMs
    return Math.min(exponentialDelay + jitter, this.options.maxDelayMs)
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.options.maxAttempts) return false
    if (this.options.shouldRetry) return this.options.shouldRetry(error)
    return true
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt < this.options.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error

        if (!this.shouldRetry(error, attempt + 1)) {
          throw error
        }

        const delay = this.calculateDelay(attempt)
        await this.sleep(delay)
      }
    }

    throw lastError
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
