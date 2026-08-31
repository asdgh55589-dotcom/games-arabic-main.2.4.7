import { getCircuitStatus, isCircuitOpen } from '@/lib/redis-circuit-breaker'
import { ok } from '@/lib/api-response'

export async function GET() {
  return ok({
    redis: getCircuitStatus(),
    isOpen: isCircuitOpen(),
    timestamp: new Date().toISOString(),
  })
}
