/**
 * games-arabic image-proxy worker — edge cache in front of FreeImage.
 *
 *   GET /img/<base64url-upstream>  →  cached image bytes
 *
 * Behavior: allowlisted upstream hosts only (SSRF guard) → caches.default
 * lookup (HIT served with long cache headers + ETag) → MISS fetches
 * upstream, validates image/* content-type, stores with
 * `Cache-Control: public, max-age=31536000, immutable`, serves with
 * X-Cache: HIT/MISS for observability.
 *
 * Pure URL logic lives in the main repo (single source of truth):
 *   src/lib/image-worker.ts  (decodeWrappedImagePath, isAllowedUpstreamHost)
 */
import { decodeWrappedImagePath, isAllowedUpstreamHost } from '../../../src/lib/image-worker'

const UPSTREAM_TIMEOUT_MS = 25_000
const MAX_UPSTREAM_BYTES = 70 * 1024 * 1024 // 70MB safety cap (FreeImage cap is 64MB)
const LONG_CACHE = 'public, max-age=31536000, immutable'

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)
    const upstream = decodeWrappedImagePath(url.pathname)
    if (!upstream) {
      return new Response('Bad image path', { status: 400 })
    }

    let upstreamUrl
    try {
      upstreamUrl = new URL(upstream)
    } catch {
      return new Response('Bad upstream URL', { status: 400 })
    }
    if (upstreamUrl.protocol !== 'http:' && upstreamUrl.protocol !== 'https:') {
      return new Response('Upstream must be http(s)', { status: 400 })
    }

    const extraHosts = String(env.ALLOWED_UPSTREAM_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean)
    if (!isAllowedUpstreamHost(upstreamUrl.hostname, extraHosts.length > 0 ? extraHosts : undefined)) {
      return new Response('Upstream host not allowed', { status: 403 })
    }

    const cache = caches.default
    const cacheKey = new Request(url.toString(), { method: 'GET' })
    const hit = await cache.match(cacheKey)
    if (hit) {
      const headers = new Headers(hit.headers)
      headers.set('X-Cache', 'HIT')
      return new Response(hit.body, { status: hit.status, headers })
    }

    let upstreamRes
    try {
      upstreamRes = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'games-arabic-image-proxy/1.0',
          Accept: 'image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })
    } catch {
      return new Response('Upstream fetch failed', { status: 502 })
    }
    if (!upstreamRes.ok) {
      return new Response('Upstream error', { status: 502 })
    }

    const contentType = upstreamRes.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return new Response('Upstream is not an image', { status: 502 })
    }
    const contentLength = Number(upstreamRes.headers.get('content-length') || 0)
    if (contentLength > MAX_UPSTREAM_BYTES) {
      return new Response('Upstream image too large', { status: 502 })
    }

    const headers = new Headers(upstreamRes.headers)
    headers.set('Cache-Control', LONG_CACHE)
    headers.set('X-Cache', 'MISS')
    headers.delete('set-cookie')

    const response = new Response(upstreamRes.body, { status: 200, headers })
    // Edge-write must not block the client response.
    ctx.waitUntil(cache.put(cacheKey, response.clone()))
    return response
  },
}
