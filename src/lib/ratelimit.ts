import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Only enable if Upstash env vars are set (no-op otherwise)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1 m') })
  : null // no-op if not configured

export async function checkRateLimit(identifier: string): Promise<boolean> {
  if (!ratelimit) return true // pass-through if not configured
  try {
    const { success } = await ratelimit.limit(identifier)
    return success
  } catch {
    return true // fail-open: never block on Redis errors
  }
}
