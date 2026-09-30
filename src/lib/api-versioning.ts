/**
 * Phase 4 — API versioning infrastructure (additive, backward compatible).
 *
 * Resolution order: URL path (`/api/v2/…`) → Accept header
 * (`application/vnd.api.v2+json`) → default `v1` (current behavior).
 * Existing unversioned routes keep working as v1 — nothing is moved.
 */

export type ApiVersion = 'v1' | 'v2'

export const API_VERSION_HEADER = 'X-API-Version'

export function getApiVersion(req: {
  headers: { get(name: string): string | null }
  url: string
  nextUrl?: { pathname: string }
}): ApiVersion {
  const pathname = req.nextUrl?.pathname ?? new URL(req.url, 'http://localhost').pathname
  if (pathname.startsWith('/api/v2/')) return 'v2'
  if (pathname.startsWith('/api/v1/')) return 'v1'
  const accept = req.headers.get('accept') ?? ''
  if (accept.includes('application/vnd.api.v2+json')) return 'v2'
  if (accept.includes('application/vnd.api.v1+json')) return 'v1'
  return 'v1'
}

/** Stamp the resolved version on a response (observability, client debugging). */
export function setApiVersionHeader<T extends { headers: { set(n: string, v: string): void } }>(
  res: T,
  version: ApiVersion,
): T {
  res.headers.set(API_VERSION_HEADER, version)
  return res
}

/** Pick a version-specific payload (lazy v2 — only computed when requested). */
export function versionedResponse<T>(req: Parameters<typeof getApiVersion>[0], v1Data: T, v2Data: T | (() => T)): T {
  if (getApiVersion(req) === 'v2') {
    return typeof v2Data === 'function' ? (v2Data as () => T)() : v2Data
  }
  return v1Data
}
