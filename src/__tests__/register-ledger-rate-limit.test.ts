/**
 * Fix 5 (Phase 4A): POST /api/auth/register-ledger rate limits.
 *
 * - 5 registrations/hour/IP → 6th is 429 with Arabic message + Retry-After
 * - 3 registrations/hour per (IP, email domain) → 4th same-domain is 429
 * - Invalid bodies still 400 (validation runs before limiting)
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest'

jest.mock('@/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const mockFindUnique = jest.fn()
const mockUpsert = jest.fn()
jest.mock('@/lib/db', () => ({
  db: { user: { findUnique: (...a: Array<never>) => mockFindUnique(...a), upsert: (...a: Array<never>) => mockUpsert(...a) } },
}))

import { POST as registerPOST } from '@/app/api/auth/register-ledger/route'

const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')

let n = 0
function regReq(body: unknown, ip: string) {
  n += 1
  return new NextRequest('http://x/api/auth/register-ledger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

function validBody(i: number, domain = 'example.com') {
  return {
    supabaseId: `sb-reg-${n}-${i}`,
    username: `reguser${n}${i}`,
    email: `user${n}${i}@${domain}`,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFindUnique.mockResolvedValue(null)
  mockUpsert.mockImplementation(async (args: any) => ({
    id: 'u-new',
    username: args.create.username,
  }))
})

describe('POST /api/auth/register-ledger rate limits', () => {
  it('allows 5/hour/IP with distinct domains, 6th → 429 Arabic + Retry-After', async () => {
    const ip = '10.200.11.1'
    const domains = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com']
    for (let i = 0; i < 5; i++) {
      const res = await registerPOST(regReq(validBody(i, domains[i]), ip))
      expect(res.status).toBe(200)
    }
    const limited = await registerPOST(regReq(validBody(99, 'f.com'), ip))
    expect(limited.status).toBe(429)
    const body = await limited.json()
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.error).toMatch('محاولات التسجيل')
    expect(limited.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0)
  })

  it('caps 3/hour per (IP, domain): 4th same-domain → 429', async () => {
    const ip = '10.200.11.2'
    for (let i = 0; i < 3; i++) {
      const res = await registerPOST(regReq(validBody(i, 'same.com'), ip))
      expect(res.status).toBe(200)
    }
    const limited = await registerPOST(regReq(validBody(99, 'same.com'), ip))
    expect(limited.status).toBe(429)
    const body = await limited.json()
    expect(body.error).toMatch('محاولات التسجيل')
  })

  it('different IP is not affected by another IP exhausting its quota', async () => {
    const res = await registerPOST(regReq(validBody(1, 'fresh.com'), '10.200.11.3'))
    expect(res.status).toBe(200)
  })

  it('invalid body → 400 without consuming quota', async () => {
    const ip = '10.200.11.4'
    const bad = await registerPOST(regReq({ username: 'x' }, ip))
    expect(bad.status).toBe(400)
    // quota untouched: 5 distinct-domain registrations still all pass
    const domains = ['g.com', 'h.com', 'i.com', 'j.com', 'k.com']
    for (let i = 0; i < 5; i++) {
      const res = await registerPOST(regReq(validBody(i, domains[i]), ip))
      expect(res.status).toBe(200)
    }
  })
})
