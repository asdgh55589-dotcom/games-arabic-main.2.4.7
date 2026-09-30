import { NextResponse } from 'next/server'

/**
 * Phase 3 — HTTP caching helpers (ETag/304, Cache-Control, Vary).
 *
 * Runtime-agnostic: uses Web Crypto only (no node:crypto import), so this
 * module is safe to import from Edge (proxy.ts) as well as Node routes.
 *
 * NOTE: ETags here are computed from the final response body (saves
 * bandwidth via 304). Short-circuiting BEFORE DB queries needs per-resource
 * version keys and is intentionally left as follow-up work.
 */

export type CachePolicy =
  | { type: 'public'; maxAge?: number; swr?: number }
  | { type: 'private'; maxAge?: number }
  | { type: 'no-store' }

/**
 * Apply a Cache-Control policy to headers.
 * - public data:  `public, max-age=60, stale-while-revalidate=300`
 * - user-scoped:  `private, max-age=…`
 * - sensitive:    `private, no-store, must-revalidate`
 */
export function setCacheControl(headers: Headers, policy: CachePolicy): void {
  if (policy.type === 'public') {
    const maxAge = policy.maxAge ?? 60
    const swr = policy.swr ?? 300
    headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`)
  } else if (policy.type === 'private') {
    headers.set('Cache-Control', `private, max-age=${policy.maxAge ?? 0}`)
  } else {
    headers.set('Cache-Control', 'private, no-store, must-revalidate')
  }
}

/** Ensure `Vary: Accept-Encoding` (append — never clobber existing Vary). */
export function addVaryHeaders(headers: Headers): void {
  const current = headers.get('Vary')
  const parts = new Set(
    (current ?? '')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  )
  parts.add('accept-encoding')
  headers.set(
    'Vary',
    [...parts].map((p) => (p === 'accept-encoding' ? 'Accept-Encoding' : p)).join(', '),
  )
}

/** SHA-256 hex of a string via Web Crypto (Edge + Node safe). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Strong ETag for a JSON-serializable payload. */
export async function etagFor(data: unknown): Promise<string> {
  return `"${await sha256Hex(JSON.stringify(data))}"`
}

function clientEtagMatches(req: { headers?: { get(name: string): string | null } }, etag: string): boolean {
  const inm = req.headers?.get('if-none-match')
  if (!inm) return false
  if (inm.trim() === '*') return true
  return inm.split(',').some((tag) => tag.trim() === etag)
}

export interface CachedResponseOptions {
  status?: number
  headers?: Headers
  policy?: CachePolicy
}

/**
 * Serialize `data` as JSON with ETag + Vary + Cache-Control.
 * Returns 304 (empty body) when the client sent a matching If-None-Match.
 */
export async function withETag(
  req: { headers?: { get(name: string): string | null } },
  data: unknown,
  opts: CachedResponseOptions = {},
): Promise<NextResponse> {
  const etag = await etagFor(data)
  const headers = new Headers(opts.headers)
  headers.set('ETag', etag)
  addVaryHeaders(headers)
  if (opts.policy) setCacheControl(headers, opts.policy)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  if (clientEtagMatches(req, etag)) {
    return new NextResponse(null, { status: 304, headers })
  }
  return new NextResponse(JSON.stringify(data), { status: opts.status ?? 200, headers })
}

/** Structural rate-limit result (matches rate-limit.ts without importing it). */
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Attach X-RateLimit-* + Retry-After to ANY response (success or 429).
 * Use on rate-limited endpoints so 2xx responses expose quota state too.
 */
export function applyRateLimitHeaders<T extends { headers: Headers }>(
  res: T,
  result: RateLimitInfo,
): T {
  res.headers.set('X-RateLimit-Limit', String(result.limit))
  res.headers.set('X-RateLimit-Remaining', String(result.remaining))
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))))
  return res
}
