import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { redisGet, redisSet, redisSetNX } from '@/lib/redis'

/**
 * Phase 4 — Idempotency keys (opt-in, Redis-backed with memory fallback).
 *
 * Clients send `Idempotency-Key: <uuid>` on POST mutations. First request
 * executes normally and its response envelope is cached 24h; replays with
 * the same key return the cached envelope + `Idempotent-Replayed: true`
 * WITHOUT re-executing side effects (no duplicate rows, no re-notify).
 *
 * Rules: absent/invalid key → normal execution (fail-open). Keys are scoped
 * per operation AND per user by the caller (operationKey must embed userId).
 */

export const IDEMPOTENCY_TTL_SECONDS = 86400 // 24h
const MAX_KEY_LENGTH = 128
const KEY_RE = /^[A-Za-z0-9_-]+$/

export interface CachedIdempotentResponse {
  status: number
  body: unknown
}

export interface IdempotencyCheck {
  /** Sanitized key ('' when absent/invalid → execute normally). */
  key: string
  isDuplicate: boolean
  cached?: CachedIdempotentResponse
}

function sanitizeKey(raw: string | null): string {
  if (!raw) return ''
  const key = raw.trim()
  if (key.length === 0 || key.length > MAX_KEY_LENGTH || !KEY_RE.test(key)) return ''
  return key
}

function respKey(operationKey: string, key: string): string {
  return `idempotency:${operationKey}:${key}:resp`
}

function lockKey(operationKey: string, key: string): string {
  return `idempotency:${operationKey}:${key}:lock`
}

/** Check for a replay BEFORE executing the mutation. Never throws. */
export async function checkIdempotency(
  req: { headers: { get(name: string): string | null } },
  operationKey: string,
): Promise<IdempotencyCheck> {
  const key = sanitizeKey(req.headers.get('Idempotency-Key'))
  if (!key) return { key: '', isDuplicate: false }
  try {
    const cached = await redisGet<CachedIdempotentResponse>(respKey(operationKey, key))
    if (cached && typeof cached.status === 'number' && cached.body !== undefined) {
      return { key, isDuplicate: true, cached }
    }
    // Claim the in-flight slot (best-effort; fail-open on contention).
    await redisSetNX(lockKey(operationKey, key), IDEMPOTENCY_TTL_SECONDS).catch(() => false)
    return { key, isDuplicate: false }
  } catch (err) {
    logger.warn({ err, operationKey }, 'idempotency check failed (fail-open)')
    return { key, isDuplicate: false }
  }
}

/** Persist the response envelope after successful execution. Never throws. */
export async function cacheIdempotentResponse(
  key: string,
  operationKey: string,
  response: CachedIdempotentResponse,
): Promise<void> {
  if (!key) return
  try {
    await redisSet(respKey(operationKey, key), response, IDEMPOTENCY_TTL_SECONDS)
  } catch (err) {
    logger.warn({ err, operationKey }, 'idempotency store failed (fail-open)')
  }
}

/** Build a replay response from cache (RFC 7807 envelope preserved as-is). */
export function idempotentReplay(cached: CachedIdempotentResponse, key: string): NextResponse {
  const res = NextResponse.json(cached.body, { status: cached.status })
  res.headers.set('Idempotent-Replayed', 'true')
  res.headers.set('Idempotency-Key', key)
  return res
}
