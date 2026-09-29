import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildProblem } from '@/lib/api-response'
import { reportError } from '@/lib/error-reporting'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

/**
 * POST /api/telemetry/edge-error — auth-free beacon for Edge (proxy) errors.
 *
 * - Rate-limited 10/min/IP (fail-OPEN on limiter error).
 * - Body size-capped at 4KB (Content-Length pre-check + raw byte check).
 * - Strict shape validation (zod, conventions per src/lib/schemas.ts).
 * - Secret-like keys stripped (dropped + counted, values never forwarded).
 * - Forwards to reportError() server-side, returns {ok:true}.
 * - Never throws: outer try/catch returns {ok:false}.
 *
 * Accepted tradeoff (auth-free by design — Edge cannot sign requests):
 * IP rate-limit key derives from x-forwarded-for (spoofable), limiter is
 * fail-open, and message is free-form ≤500 chars, so a determined caller
 * can spend Sentry quota with rotated identities. Contained by: 10/min/IP,
 * 4KB cap, strict shape, secret stripping, Sentry dedup grouping. Follow-up:
 * same-origin/edge-shared secret or fixed-code-only payloads.
 */

const MAX_BODY_BYTES = 4096

const EdgeErrorSchema = z.object({
  message: z.string().min(1).max(500),
  route: z.string().max(200).optional(),
  requestId: z.string().max(64).optional(),
  digest: z.string().max(64).optional(),
})

const SECRET_KEY_RE = /password|passwd|pwd|token|apikey|api_key|api-key|authorization|auth|secret|session|cookie/i

function stripSecrets(value: unknown): { clean: unknown; stripped: number } {
  let stripped = 0
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (node !== null && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (SECRET_KEY_RE.test(k)) {
          stripped++
          continue
        }
        out[k] = walk(v)
      }
      return out
    }
    return node
  }
  return { clean: walk(value), stripped }
}

export async function POST(req: Request) {
  try {
    // Rate limit: 10/min/IP — fail-OPEN on limiter error (ratelimit.ts pattern).
    try {
      const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'telemetry:edge-error' })
      if (!rl.success) {
        const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
        return NextResponse.json(
          {
            ok: false,
            error: 'RATE_LIMITED',
            problem: buildProblem(
              'RATE_LIMITED',
              'Rate limit exceeded',
              429,
              'Too many requests — try again later',
              '/api/telemetry/edge-error',
            ),
          },
          {
            status: 429,
            headers: { ...rateLimitHeaders(rl), 'Retry-After': String(retryAfter) },
          },
        )
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort telemetry
    }

    // Size cap: Content-Length pre-check (cheap reject before reading body).
    const contentLength = req.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }

    const raw = await req.text().catch(() => '')
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
    }

    let parsed: unknown = null
    try {
      parsed = raw ? (JSON.parse(raw) as unknown) : null
    } catch {
      return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 })
    }

    // Strip secret-like keys (drop + count; values never leave this handler).
    const { clean } = stripSecrets(parsed)

    const validated = EdgeErrorSchema.safeParse(clean)
    if (!validated.success) {
      // 422 (not 400) — Phase 1 validation standardization. Beacon protocol
      // ({ok:false}) is preserved; problem is additive.
      return NextResponse.json(
        {
          ok: false,
          error: 'VALIDATION_ERROR',
          problem: buildProblem(
            'VALIDATION_ERROR',
            'Invalid input data',
            422,
            'One or more fields failed validation',
            '/api/telemetry/edge-error',
          ),
        },
        { status: 422 },
      )
    }
    const { message, route, requestId } = validated.data

    try {
      reportError(new Error(message), {
        route: route ?? 'edge-beacon',
        ...(requestId ? { requestId } : {}),
        action: 'edge-beacon',
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort telemetry
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
