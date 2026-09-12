/**
 * Circuit Breaker for Redis operations (audit D.2 tuning).
 * Prevents hammering Redis when it's down; callers fall back to the
 * in-memory TTL store (lib/redis.ts) or DB.
 *
 * Policy: 5 failures inside a rolling 60s window OPEN the circuit →
 * local mode for 5 minutes → half-open trial on next call → success
 * closes it. Failures spread beyond the window never trip it.
 */

let redisFailures = 0
let lastFailure = 0
let windowStart = 0
const FAILURE_THRESHOLD = 5
const FAILURE_WINDOW_MS = 60 * 1000 // 60s rolling window
const RECOVERY_TIME = 5 * 60 * 1000 // 5 minutes local mode

function inWindow(now: number): boolean {
  if (now - windowStart > FAILURE_WINDOW_MS) {
    redisFailures = 0
    windowStart = now
    return true
  }
  return true
}

export async function withRedisCircuit<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  const now = Date.now()

  // If circuit is open (threshold hit inside the window), use fallback immediately
  if (redisFailures >= FAILURE_THRESHOLD && now - lastFailure < RECOVERY_TIME) {
    return fallback()
  }

  try {
    const result = await operation()
    // Reset on success — Redis is back
    redisFailures = 0
    windowStart = now
    return result
  } catch (error) {
    inWindow(now)
    redisFailures++
    lastFailure = now
    console.error(`[CircuitBreaker] Redis failure #${redisFailures}:`, error)
    return fallback()
  }
}

export function isCircuitOpen(): boolean {
  return redisFailures >= FAILURE_THRESHOLD && Date.now() - lastFailure < RECOVERY_TIME
}

export function getCircuitStatus(): string {
  if (redisFailures === 0) return 'CLOSED (healthy)'
  if (isCircuitOpen()) return 'OPEN (using fallback)'
  return `HALF-OPEN (${redisFailures}/${FAILURE_THRESHOLD} failures)`
}

/** Test/health hook — resets counters (never call in request paths). */
export function resetCircuitState(): void {
  redisFailures = 0
  lastFailure = 0
  windowStart = 0
}
