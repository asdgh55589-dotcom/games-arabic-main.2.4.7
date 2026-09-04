import {
  ConsecutiveBreaker,
  circuitBreaker,
  ExponentialBackoff,
  handleAll,
  retry,
  wrap,
} from 'cockatiel'

// NOTE: cockatiel v4 uses the functional API (retry(handleAll, {...})),
// not the old chainable Policy.handleAll().retry().exponential() style.
// Semantics below match the original intent.

// Retry policy for external APIs (3 attempts, exponential backoff 200ms → 5s)
export const apiRetry = retry(handleAll, {
  maxAttempts: 3,
  backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 5000, exponent: 2 }),
})

// Circuit breaker (open after 5 consecutive failures, half-open after 30s)
export const apiBreaker = circuitBreaker(handleAll, {
  halfOpenAfter: 30_000,
  breaker: new ConsecutiveBreaker(5),
})

// Combined: retry + circuit breaker
export const apiPolicy = wrap(apiRetry, apiBreaker)

// Telegram-specific: stricter (2 attempts, faster start)
export const telegramPolicy = retry(handleAll, {
  maxAttempts: 2,
  backoff: new ExponentialBackoff({ initialDelay: 100, maxDelay: 2000, exponent: 2 }),
})
