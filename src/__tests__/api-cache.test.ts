/**
 * Phase 3 — HTTP caching contract tests (ETag/304, Cache-Control, Vary,
 * rate-limit headers on success).
 */
import {
  applyRateLimitHeaders,
  etagFor,
  setCacheControl,
  withETag,
} from '@/lib/api-cache'

function req(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  }
}

describe('etagFor', () => {
  it('is stable and quoted', async () => {
    const a = await etagFor({ x: 1 })
    expect(a).toBe(await etagFor({ x: 1 }))
    expect(a).toMatch(/^"[0-9a-f]{64}"$/)
  })
  it('changes with the payload', async () => {
    expect(await etagFor({ x: 1 })).not.toBe(await etagFor({ x: 2 }))
  })
})

describe('withETag', () => {
  it('returns 200 with ETag + Vary + JSON body on first hit', async () => {
    const res = await withETag(req(), { data: [1, 2] })
    expect(res.status).toBe(200)
    expect(res.headers.get('ETag')).toMatch(/^"/)
    expect(res.headers.get('Vary')).toMatch(/Accept-Encoding/)
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/)
    expect(await res.json()).toEqual({ data: [1, 2] })
  })

  it('returns 304 on matching If-None-Match (empty body)', async () => {
    const first = await withETag(req(), { data: [1, 2] })
    const etag = first.headers.get('ETag')!
    const second = await withETag(req({ 'if-none-match': etag }), { data: [1, 2] })
    expect(second.status).toBe(304)
    expect(await second.text()).toBe('')
    expect(second.headers.get('ETag')).toBe(etag)
  })

  it('returns 200 on stale/mismatched etag', async () => {
    const res = await withETag(req({ 'if-none-match': '"stale"' }), { data: 1 })
    expect(res.status).toBe(200)
  })

  it('supports If-None-Match: *', async () => {
    const res = await withETag(req({ 'if-none-match': '*' }), { data: 1 })
    expect(res.status).toBe(304)
  })
})

describe('setCacheControl', () => {
  it('public policy', () => {
    const h = new Headers()
    setCacheControl(h, { type: 'public', maxAge: 60, swr: 300 })
    expect(h.get('Cache-Control')).toBe('public, max-age=60, stale-while-revalidate=300')
  })
  it('no-store policy', () => {
    const h = new Headers()
    setCacheControl(h, { type: 'no-store' })
    expect(h.get('Cache-Control')).toBe('private, no-store, must-revalidate')
  })
  it('private policy', () => {
    const h = new Headers()
    setCacheControl(h, { type: 'private', maxAge: 0 })
    expect(h.get('Cache-Control')).toBe('private, max-age=0')
  })
})

describe('applyRateLimitHeaders', () => {
  it('sets X-RateLimit-* + Retry-After on any response', () => {
    const res = new Response('ok')
    applyRateLimitHeaders(res, { limit: 30, remaining: 12, resetAt: Date.now() + 45000 })
    expect(res.headers.get('X-RateLimit-Limit')).toBe('30')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('12')
    expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
  })
})
