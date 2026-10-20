import type { NextRequest } from 'next/server'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE'])

function getAllowedOrigins(): string[] {
  const set = new Set<string>()
  const env = process.env.ALLOWED_ORIGINS
  if (env) {
    env
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean)
      .forEach((o) => set.add(o))
  }
  for (const v of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL, process.env.APP_URL]) {
    if (v) set.add(v.trim().replace(/\/$/, ''))
  }
  return [...set]
}

export function isTokenAuth(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  return !!auth && /^Bearer\s+/i.test(auth)
}

export function validateCsrf(req: NextRequest): { valid: boolean; reason?: string } {
  const method = req.method.toUpperCase()
  if (SAFE_METHODS.has(method)) {
    return { valid: true }
  }

  // Token-authenticated requests are not CSRF-vulnerable: the token is not
  // automatically attached by the browser, so a cross-site request cannot
  // replay it.
  if (isTokenAuth(req)) {
    return { valid: true }
  }

  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host') || req.nextUrl.host
  const allowed = getAllowedOrigins()

  const originAllowed = (value: string): boolean => {
    try {
      const url = new URL(value)
      if (url.host === host) return true
      return allowed.includes(url.origin)
    } catch {
      return false
    }
  }

  if (origin) {
    if (originAllowed(origin)) return { valid: true }
    return { valid: false, reason: 'Origin not allowed' }
  }

  if (referer) {
    try {
      const url = new URL(referer)
      if (url.host === host) return { valid: true }
      if (allowed.includes(url.origin)) return { valid: true }
      return { valid: false, reason: 'Referer not allowed' }
    } catch {
      return { valid: false, reason: 'Malformed referer' }
    }
  }

  return { valid: false, reason: 'Missing Origin/Referer' }
}
