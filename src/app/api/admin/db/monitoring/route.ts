import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, rateLimited, unauthorized } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { isConnectionHealthy } from '@/lib/db'
import { dbCircuitBreaker } from '@/lib/observability/db-circuit-breaker'
import { DbMonitor } from '@/lib/observability/db-monitor'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// GET /api/admin/db/monitoring — real-time DB pool/query telemetry (admin-only).
// Backed by DbMonitor (30s collection throttle + 4s probe timeouts), so this
// endpoint itself can never stampede the pool. Rate-limited: 10/min per IP.
export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'admin:db-monitoring' })
  if (!rl.success) {
    return rateLimited('تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً.', 60)
  }

  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) {
      return err.status === 401
        ? unauthorized('Unauthorized')
        : forbidden('Forbidden — admin access required')
    }
    return internalError('Failed')
  }

  try {
    // One collection only — checkHealth reuses it (its internal fetch is throttled).
    const metrics = await DbMonitor.getMetrics()
    const health = await DbMonitor.checkHealth(metrics)
    return ok({
      status: health.healthy ? 'healthy' : 'degraded',
      metrics,
      issues: health.issues,
      circuitBreaker: dbCircuitBreaker.getState(),
      connectionHealthy: isConnectionHealthy(),
      time: new Date().toISOString(),
    })
  } catch {
    return internalError('Failed to collect DB metrics')
  }
}
