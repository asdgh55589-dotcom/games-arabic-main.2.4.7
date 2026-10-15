import { applyRateLimitHeaders } from '@/lib/api-cache'
import { rateLimit } from '@/lib/rate-limit'

/**
 * lib/read-observe.ts — transparent X-RateLimit-* headers for public
 * non-heavy reads (Phase 2 batch T3+T4).
 *
 * Observation only: generous bucket (300/min), headers attached to the
 * 2xx response, NEVER blocks (no 429 from here), never throws. Heavy reads
 * are enforced separately in proxy.ts (60/min, read:heavy). Any failure
 * falls through to the plain response.
 */

const OBSERVE_LIMIT = 300
const OBSERVE_WINDOW_S = 60

export async function withReadObserveHeaders<T extends { headers: Headers }>(
  req: Request,
  res: T,
): Promise<T> {
  try {
    const rl = await Promise.race([
      rateLimit(req, { limit: OBSERVE_LIMIT, window: OBSERVE_WINDOW_S, keyPrefix: 'read:observe' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 800)),
    ])
    if (rl) return applyRateLimitHeaders(res, rl)
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: observation only — the response is already built
  }
  return res
}
