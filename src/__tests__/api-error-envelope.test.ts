/**
 * Phase 1 — Error handling foundation contract tests.
 * Every error response MUST carry BOTH:
 *   - `error`: legacy envelope (code/message/details) + requestId + timestamp
 *   - `problem`: RFC 7807 fields (type/title/status/detail + optional instance)
 */
import {
  accountLocked,
  buildProblem,
  conflict,
  fail,
  forbidden,
  internalError,
  notFound,
  rateLimited,
  unauthorized,
  validationFail,
} from '@/lib/api-response'

async function bodyOf(res: Response) {
  return (await res.json()) as {
    error?: { code?: string; message?: string; details?: unknown; requestId?: string; timestamp?: string }
    problem?: { type?: string; title?: string; status?: number; detail?: string; instance?: string }
  }
}

describe('fail() unified envelope', () => {
  it('includes error AND problem with matching status', async () => {
    const res = fail('NOT_FOUND', 'Mod not found', 404, undefined, 'req-1', '/api/mods/x')
    expect(res.status).toBe(404)
    const body = await bodyOf(res)
    expect(body.error?.code).toBe('NOT_FOUND')
    expect(body.error?.message).toBe('Mod not found')
    expect(body.error?.requestId).toBe('req-1')
    expect(body.error?.timestamp).toBeDefined()
    expect(body.problem).toBeDefined()
    expect(body.problem?.type).toBe('/errors/not-found')
    expect(body.problem?.status).toBe(404)
    expect(body.problem?.instance).toBe('/api/mods/x')
  })

  it('derives problem type from code (underscores → dashes, lowercase)', () => {
    expect(buildProblem('VALIDATION_ERROR', 't', 422, 'd').type).toBe('/errors/validation-error')
    expect(buildProblem('IP_BANNED', 't', 403, 'd').type).toBe('/errors/ip-banned')
    expect(buildProblem('TOKEN_VERSION_UNVERIFIED', 't', 503, 'd').type).toBe(
      '/errors/token-version-unverified',
    )
  })

  it('generates a requestId when none is provided', async () => {
    const body = await bodyOf(fail('INTERNAL_ERROR', 'oops', 500))
    expect(typeof body.error?.requestId).toBe('string')
    expect(body.error?.requestId.length).toBeGreaterThan(0)
  })

  it('omits instance when not provided', async () => {
    const body = await bodyOf(fail('CONFLICT', 'dup', 409))
    expect(body.problem?.instance).toBeUndefined()
  })
})

describe('validationFail() standardization', () => {
  it('ALWAYS returns 422 with VALIDATION_ERROR code', async () => {
    const res = validationFail({ fieldErrors: { title: ['required'] } })
    expect(res.status).toBe(422)
    const body = await bodyOf(res)
    expect(body.error?.code).toBe('VALIDATION_ERROR')
    expect(body.problem?.type).toBe('/errors/validation-error')
    expect(body.problem?.status).toBe(422)
  })

  it('preserves the legacy "Invalid input" message (sentry-filters contract)', async () => {
    const body = await bodyOf(validationFail('bad'))
    expect(body.error?.message).toBe('Invalid input')
  })
})

describe('rateLimited() Retry-After guarantee', () => {
  it('ALWAYS sets Retry-After (default 60s)', async () => {
    const res = rateLimited()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('60')
    const body = await bodyOf(res)
    expect(body.error?.code).toBe('RATE_LIMITED')
    expect(body.problem?.status).toBe(429)
  })

  it('honors explicit retry seconds', async () => {
    expect(rateLimited('slow down', 120).headers.get('Retry-After')).toBe('120')
  })

  it('accountLocked carries Retry-After too', async () => {
    const res = accountLocked('locked', 300)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('300')
    expect((await bodyOf(res)).error?.code).toBe('ACCOUNT_LOCKED')
  })
})

describe('internalError() never leaks internals by default', () => {
  it('returns a generic message without stack or query text', async () => {
    const res = internalError()
    expect(res.status).toBe(500)
    const raw = JSON.stringify(await res.json())
    expect(raw).not.toMatch(/stack|ECONNREFUSED|SELECT|at /i)
    const body = JSON.parse(raw) as { error?: { code?: string }; problem?: { status?: number } }
    expect(body.error?.code).toBe('INTERNAL_ERROR')
    expect(body.problem?.status).toBe(500)
  })
})

describe('convenience helpers carry problem field', () => {
  it.each([
    [notFound(), 404, 'NOT_FOUND'],
    [unauthorized(), 401, 'UNAUTHORIZED'],
    [forbidden(), 403, 'FORBIDDEN'],
    [conflict(), 409, 'CONFLICT'],
  ])('helper → %p', async (res, status, code) => {
    expect(res.status).toBe(status)
    const body = await bodyOf(res)
    expect(body.error?.code).toBe(code)
    expect(body.problem?.status).toBe(status)
  })
})
