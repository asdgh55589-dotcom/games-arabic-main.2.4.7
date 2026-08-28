/**
 * DeliveryPolicy — سياسة التوصيل
 * Determines retry behavior and circuit breaker state.
 */

import { NotificationJob } from '../entities'

export interface DeliveryPolicy {
  /** Check if a failed job should be retried */
  shouldRetry(job: NotificationJob): boolean

  /** Calculate delay before next retry (exponential backoff with jitter) */
  calculateRetryDelay(attempt: number): number

  /** Check if the circuit breaker is open for a service */
  isCircuitOpen(service: string): boolean
}

/**
 * Exponential backoff with jitter implementation.
 * Base delay: 1s → 2s → 4s → 8s → 16s (capped at 5 minutes)
 */
export class ExponentialBackoffDeliveryPolicy implements DeliveryPolicy {
  constructor(
    private readonly baseDelayMs: number = 1000,
    private readonly maxDelayMs: number = 300_000, // 5 minutes
    private readonly jitterMs: number = 1000,
  ) {}

  shouldRetry(job: NotificationJob): boolean {
    return job.canRetry()
  }

  calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attempt)
    const jitter = Math.random() * this.jitterMs
    return Math.min(exponentialDelay + jitter, this.maxDelayMs)
  }

  isCircuitOpen(_service: string): boolean {
    // Phase 3 will implement Circuit Breaker
    return false
  }
}
