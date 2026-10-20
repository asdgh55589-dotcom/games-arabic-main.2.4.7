import { validateCsrf, isTokenAuth } from '@/lib/csrf'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

function req(method: string, headers: Record<string, string> = {}, url = 'http://localhost:3000/api/creator/mods') {
  return new NextRequest(url, { method, headers })
}

describe('validateCsrf', () => {
  const OLD_ENV = process.env
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.ALLOWED_ORIGINS
    delete process.env.NEXT_PUBLIC_APP_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.APP_URL
  })
  afterAll(() => { process.env = OLD_ENV })

  it('allows safe methods', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      expect(validateCsrf(req(m)).valid).toBe(true)
    }
  })

  it('allows bearer token auth requests', () => {
    const r = req('POST', { authorization: 'Bearer sk_live_abc', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(true)
  })

  it('allows same-origin POST with origin', () => {
    const r = req('POST', { origin: 'http://localhost:3000', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(true)
  })

  it('allows same-origin POST with referer only', () => {
    const r = req('POST', { referer: 'http://localhost:3000/creator/mods', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(true)
  })

  it('rejects cross-origin POST', () => {
    const r = req('POST', { origin: 'https://evil.com', host: 'localhost:3000' })
    const res = validateCsrf(r)
    expect(res.valid).toBe(false)
  })

  it('rejects missing origin+referer on POST', () => {
    const r = req('POST', { host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(false)
  })

  it('rejects malformed origin', () => {
    const r = req('POST', { origin: 'not-a-url', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(false)
  })

  it('allows allowlisted origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://trusted.com'
    const r = req('POST', { origin: 'https://trusted.com', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(true)
  })

  it('rejects disallowed origin even if in env? no', () => {
    process.env.ALLOWED_ORIGINS = 'https://trusted.com'
    const r = req('POST', { origin: 'https://evil.com', host: 'localhost:3000' })
    expect(validateCsrf(r).valid).toBe(false)
  })

  it('isTokenAuth detects bearer', () => {
    const r = req('GET', { authorization: 'Bearer xyz' })
    expect(isTokenAuth(r)).toBe(true)
    const r2 = req('GET', {})
    expect(isTokenAuth(r2)).toBe(false)
  })
})
