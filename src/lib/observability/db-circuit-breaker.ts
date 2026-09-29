/**
 * lib/observability/db-circuit-breaker.ts — DB failure circuit breaker.
 *
 * CLOSED → (threshold consecutive failures) → OPEN → (cooldown) → HALF_OPEN
 * → success → CLOSED. Non-critical operations fail OPEN (return null);
 * critical ones (auth/session truth) fail CLOSED (throw).
 *
 * This is separate from `lib/redis-circuit-breaker.ts` (Redis/Upstash path).
 */
import { logger } from '@/lib/logger'

export type DbCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class DbCircuitBreaker {
  private state: DbCircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0

  constructor(
    private readonly threshold: number = 5,
    private readonly cooldownMs: number = 30_000,
  ) {}

  async execute<T>(operation: () => Promise<T>, critical = false): Promise<T | null> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed > this.cooldownMs) {
        this.state = 'HALF_OPEN'
        logger.info({ event: 'db_circuit_half_open' }, 'DB circuit breaker: HALF_OPEN — testing connection')
      } else {
        logger.warn({ event: 'db_circuit_open_reject', elapsedMs: elapsed }, 'DB circuit breaker: OPEN — rejecting request')
        if (critical) throw new Error('DB circuit breaker open')
        return null
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err as Error)
      if (critical) throw err
      return null
    }
  }

  getState(): { state: DbCircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount }
  }

  /** Test seam: force back to CLOSED. */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = 0
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info({ event: 'db_circuit_closed' }, 'DB circuit breaker: CLOSED — connection recovered')
    }
    this.state = 'CLOSED'
    this.failureCount = 0
  }

  private onFailure(err: Error): void {
    this.failureCount += 1
    this.lastFailureTime = Date.now()
    logger.error(
      { event: 'db_circuit_failure', failureCount: this.failureCount, err },
      'DB circuit breaker: failure',
    )
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN'
      logger.error(
        { event: 'db_circuit_open', failureCount: this.failureCount },
        'DB circuit breaker: OPEN',
      )
    }
  }
}

export const dbCircuitBreaker = new DbCircuitBreaker()
