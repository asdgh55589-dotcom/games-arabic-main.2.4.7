import type { NextRequest, NextResponse } from 'next/server'
import { createRequestLogger, logError, type RequestLogger } from '@/lib/logger'
import { trackRoute } from '@/lib/observability/middleware'

/**
 * Phase 2 observability — request-scoped logging + RED metrics for API routes.
 *
 * Opt-in wrapper (adopt per route; proxy.ts covers unmatched paths globally):
 *
 *   import { withRequestLogger } from '@/lib/request-logger'
 *   export const GET = withRequestLogger(async (req, log) => {
 *     log.info('Fetching users…')
 *     …
 *   }, 'GET /api/users')
 *
 * The handler receives a child logger carrying { requestId, route } and every
 * invocation records RED (rate/errors/duration) via trackRoute().
 */

function getOrCreateRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID()
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export function withRequestLogger<TContext = unknown>(
  handler: (req: NextRequest, ctx: TContext, log: RequestLogger) => Promise<NextResponse>,
  routeName: string,
) {
  return async (req: NextRequest, ctx: TContext): Promise<NextResponse> => {
    const requestId = getOrCreateRequestId(req)
    const path = (() => {
      try {
        return req.nextUrl.pathname
      } catch {
        return routeName
      }
    })()
    const route = `${req.method} ${path}`
    const finish = trackRoute(route)
    const start = Date.now()
    const log = createRequestLogger(requestId, route, {
      routeName,
      ip: clientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    log.debug('Request started')

    let status = 500
    try {
      const res = await handler(req, ctx, log)
      status = res.status
      res.headers.set('x-request-id', requestId)
      return res
    } catch (error) {
      logError(error, { requestId, route })
      throw error
    } finally {
      const durationMs = Date.now() - start
      try {
        finish(durationMs, status >= 500)
      } catch {
        // best-effort metrics — never break the request
      }
      log.info({ status, durationMs }, 'Request completed')
    }
  }
}
