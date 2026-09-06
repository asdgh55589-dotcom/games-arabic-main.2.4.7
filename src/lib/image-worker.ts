/**
 * Cloudflare Worker image-proxy helpers (server + client safe — no secrets).
 * The worker edge-caches upstream FreeImage URLs; see workers/image-proxy.
 */

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
