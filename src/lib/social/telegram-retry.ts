import { TelegramRateLimitError } from './telegram-send'

export async function withTelegramRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (err instanceof TelegramRateLimitError) {
        await new Promise((r) => setTimeout(r, err.retryAfter * 1000))
        continue
      }
      throw err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Max retries exceeded')
}