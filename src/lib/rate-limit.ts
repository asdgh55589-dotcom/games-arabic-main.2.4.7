/**
 * lib/rate-limit.ts — Rate limiting يستخدم Redis مع fallback لـ in-memory.
 */

import { redisIncr } from './redis'
import { NextResponse } from 'next/server'

interface RateLimitEntry { count: number; resetAt: number }
const memoryStore = new Map<string, RateLimitEntry>()
const MAX_STORE_SIZE = 10000

interface RateLimitOptions { limit: number; window: number; keyPrefix?: string }
interface RateLimitResult { success: boolean; remaining: number; resetAt: number; limit: number }

export async function rateLimit(req: Request, options: RateLimitOptions): Promise<RateLimitResult> {
  const ip = getClientIP(req)
  const key = `${options.keyPrefix || 'default'}:${ip}`
  const now = Date.now()
  const windowMs = options.window * 1000

  const redisKey = `ratelimit:${key}`
  const count = await redisIncr(redisKey, options.window)

  if (count > 0) {
    return {
      success: count <= options.limit,
      remaining: Math.max(0, options.limit - count),
      resetAt: now + windowMs,
      limit: options.limit,
    }
  }

  if (memoryStore.size >= MAX_STORE_SIZE) {
    const oldestKey = memoryStore.keys().next().value
    if (oldestKey) memoryStore.delete(oldestKey)
  }

  const entry = memoryStore.get(key)
  const resetAt = now + windowMs

  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt })
    return { success: true, remaining: options.limit - 1, resetAt, limit: options.limit }
  }

  entry.count++
  memoryStore.set(key, entry)

  if (entry.count > options.limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt, limit: options.limit }
  }

  return { success: true, remaining: options.limit - entry.count, resetAt: entry.resetAt, limit: options.limit }
}

export async function rateLimitMiddleware(
  req: Request,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const result = await rateLimit(req, options)
  if (!result.success) {
    return NextResponse.json(
      { error: 'عدد كبير من الطلبات، حاول مرة أخرى لاحقاً', code: 'RATE_LIMITED' },
      { status: 429, headers: rateLimitHeaders(result) }
    )
  }
  return null
}

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP
  return 'unknown'
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
  }
}
