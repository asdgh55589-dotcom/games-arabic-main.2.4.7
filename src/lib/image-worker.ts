/**
 * Cloudflare Worker image-proxy helpers (server + client safe — no secrets).
 * The worker edge-caches upstream FreeImage URLs; see workers/image-proxy.
 * Pure functions here are the SINGLE source of truth — the worker imports
 * them, and jest tests them (the worker runtime itself is verified with
 * `wrangler dev` at deploy time).
 */

/** Upstream image hosts the worker will ever fetch (SSRF allowlist). */
export const IMAGE_UPSTREAM_ALLOWLIST = ['iili.io', 'freeimage.host', 'www.freeimage.host']

export function getImageWorkerDomain(): string {
  return (process.env.IMG_WORKER_DOMAIN || '').trim().replace(/\/+$/, '')
}

export function isImageWorkerConfigured(): boolean {
  return getImageWorkerDomain().length > 0
}

function base64UrlEncode(s: string): string {
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(s, 'utf8').toString('base64')
      : btoa(unescape(encodeURIComponent(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Edge-cached URL for an upstream image. Returns null when the worker is
 * not configured yet — callers must fall back to the original URL.
 * Only wraps http(s) URLs (never data: or relative paths).
 */
export function wrapImageUrl(originalUrl: string): string | null {
  if (typeof originalUrl !== 'string' || !/^https?:\/\//i.test(originalUrl)) return null
  const domain = getImageWorkerDomain()
  if (!domain) return null
  return `https://${domain}/img/${base64UrlEncode(originalUrl)}`
}

function base64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  return decodeURIComponent(escape(atob(padded)))
}

/** Reverse of the /img/<b64url> path — null on bad encoding. */
export function decodeWrappedImagePath(path: string): string | null {
  const m = /^\/img\/([A-Za-z0-9\-_]+)\/?$/.exec(path || '')
  if (!m) return null
  try {
    const url = base64UrlDecode(m[1])
    return /^https?:\/\//i.test(url) ? url : null
  } catch {
    return null
  }
}

/** SSRF guard: hostname must be on the allowlist (exact or subdomain). */
export function isAllowedUpstreamHost(hostname: string, allowlist: string[] = IMAGE_UPSTREAM_ALLOWLIST): boolean {
  const host = (hostname || '').toLowerCase().replace(/\.$/, '')
  return allowlist.some((allowed) => {
    const a = allowed.toLowerCase()
    return host === a || host.endsWith(`.${a}`)
  })
}
