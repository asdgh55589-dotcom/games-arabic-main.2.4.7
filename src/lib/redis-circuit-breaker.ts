/**
 * Circuit Breaker for Redis operations
 * Prevents hammering Redis when it's down
 * Falls back to DB after threshold failures
 */

let redisFailures = 0
let lastFailure = 0
const FAILURE_THRESHOLD = 5
const RECOVERY_TIME = 60000 // 1 minute

export async function withRedisCircuit<T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  const now = Date.now()

  // If circuit is open (too many failures), use fallback immediately
  if (redisFailures >= FAILURE_THRESHOLD && now - lastFailure < RECOVERY_TIME) {
    return fallback()
  }

  try {
    const result = await operation()
    // Reset on success — Redis is back
    redisFailures = 0
    return result
  } catch (error) {
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
