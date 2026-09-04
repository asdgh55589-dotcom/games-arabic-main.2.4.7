import { ok } from '@/lib/api-response'
import { getCircuitStatus, isCircuitOpen } from '@/lib/redis-circuit-breaker'

export async function GET() {
  return ok({
    redis: getCircuitStatus(),
    isOpen: isCircuitOpen(),
    timestamp: new Date().toISOString(),
  })
}
