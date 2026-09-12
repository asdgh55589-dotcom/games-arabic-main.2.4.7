import { ok } from '@/lib/api-response'

// GET /api/health — liveness probe for deploy smoke checks.
// Public, dependency-free (must answer even when DB/Redis are down).
export async function GET() {
  return ok({ status: 'ok', time: new Date().toISOString() })
}
