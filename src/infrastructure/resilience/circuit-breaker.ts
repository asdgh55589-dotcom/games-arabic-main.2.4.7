/**
 * CircuitBreaker — قاطع الدارة
 * Prevents cascading failures by stopping calls to a failing service.
 * Thread-safe: no race conditions in state transitions.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeoutMs: number
  halfOpenMaxAttempts: number
  onStateChange?: (from: CircuitState, to: CircuitState) => void
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private halfOpenAttempts = 0
  private lock = false

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {}

  get currentState(): CircuitState {
    return this.state
  }

  get isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.transitionTo('HALF_OPEN')
        return false
      }
      return true
    }
    return false
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new CircuitOpenError(this.name)
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++
      if (this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        this.transitionTo('CLOSED')
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      this.transitionTo('OPEN')
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo('OPEN')
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.lock) return
    this.lock = true

    const oldState = this.state
    this.state = newState

    if (newState === 'CLOSED') {
      this.failureCount = 0
      this.halfOpenAttempts = 0
    }
    if (newState === 'HALF_OPEN') {
      this.halfOpenAttempts = 0
    }

    this.options.onStateChange?.(oldState, newState)
    this.lock = false
  }

  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.halfOpenAttempts = 0
  }
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker "${circuitName}" is OPEN. Operation rejected.`)
    this.name = 'CircuitOpenError'
  }
}
