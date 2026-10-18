/**
 * Regression: creator session heal (/creator → /login bounce).
 *
 * Bug: `ga_admin_role` is a fixed 7-day JWT that is never refreshed, while the
 * Supabase session auto-refreshes forever. Once the role cookie expires the user
 * still looks logged in (navbar reads /api/auth/me) but the Edge gate in
 * proxy.ts — which reads ONLY the cookie — bounced them to /login.
 *
 * The open-redirect cases below are security-critical: WHATWG URL parsing
 * strips C0 control characters, so "/<TAB>/evil.com" collapses to the
 * protocol-relative "//evil.com". safeNext is unit-tested directly so a
 * regression on the SUCCESS path (the only branch that can emit an off-origin
 * Location) cannot pass unnoticed.
 */
import { NextRequest } from 'next/server'

process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://u:p@localhost:5432/test?sslmode=require&connection_limit=1&pool_timeout=1&connect_timeout=1'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest-32-chars!'

const ORIGIN = 'http://localhost:3000'

const { safeNext } =
  require('@/app/api/auth/heal-role/route') as typeof import('@/app/api/auth/heal-role/route')

describe('safeNext — open-redirect hardening (unit)', () => {
  it.each([
    ['absolute url', 'https://evil.com/steal'],
    ['protocol-relative', '//evil.com'],
    ['backslash', '/\\evil.com'],
    ['tab control char', '/\t/evil.com'],
    ['newline control char', '/\n/evil.com'],
    ['carriage-return control char', '/\r/evil.com'],
    ['null byte', '/\u0000/evil.com'],
    ['traversal', '/creator/../../admin'],
    ['trailing traversal', '/creator/..'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['empty', ''],
    ['null', null],
  ])('rejects %s → /creator', (_label, hostile) => {
    expect(safeNext(hostile as string | null, ORIGIN)).toBe('/creator')
  })

  it.each([['/creator'], ['/creator/studio'], ['/creator/news?tab=drafts']])(
    'keeps the internal path %s',
    (path) => {
      expect(safeNext(path, ORIGIN)).toBe(path)
    },
  )

  it('never resolves off-origin, whatever the input', () => {
    const hostile = [
      '/\t/evil.com',
      '//evil.com',
      'https://evil.com',
      '/\n/evil.com',
      '/\\evil.com',
      '/creator/../../admin',
    ]
    for (const h of hostile) {
      const resolved = new URL(safeNext(h, ORIGIN), ORIGIN)
      expect(resolved.origin).toBe(ORIGIN)
    }
  })
})

describe('heal route behaviour', () => {
  it('exports a GET handler', () => {
    const mod =
      require('@/app/api/auth/heal-role/route') as typeof import('@/app/api/auth/heal-role/route')
    expect(typeof mod.GET).toBe('function')
  })

  it('without a valid session → 307 to /login, staying on-origin', async () => {
    const { GET } =
      require('@/app/api/auth/heal-role/route') as typeof import('@/app/api/auth/heal-role/route')
    const req = new NextRequest(`${ORIGIN}/api/auth/heal-role?next=%2Fcreator`)
    const res = await GET(req)
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc.startsWith(`${ORIGIN}/`)).toBe(true)
    expect(loc).not.toContain('evil.com')
  })
})

describe('proxy creator gate routes stale cookies through heal (static pin)', () => {
  const proxy = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '..', 'proxy.ts'),
    'utf8',
  ) as string

  it('creator gate targets /api/auth/heal-role when a Supabase user exists', () => {
    expect(proxy).toContain("new URL('/api/auth/heal-role', req.url)")
    expect(proxy).toMatch(/const bounceTo = user\s*\n?\s*\? new URL\('\/api\/auth\/heal-role'/)
    // No-session users still go to /login (never to heal — it would loop).
    expect(proxy).toContain("new URL('/login', req.url)")
  })

  it('preserves the original path for both branches', () => {
    expect(proxy).toMatch(/bounceTo\.searchParams\.set\('next', pathname\)/)
  })

  it('marks the reason so the bounce is diagnosable in logs', () => {
    expect(proxy).toContain("'role_cookie_stale'")
    expect(proxy).toContain("'no_session'")
  })
})

describe('heal helper is shared (no duplicate resolve logic)', () => {
  it('creator-requests imports the shared helper instead of redefining it', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'app', 'api', 'creator-requests', 'route.ts'),
      'utf8',
    )
    expect(src).toContain("from '@/lib/resolve-with-heal'")
    expect(src).toContain('resolveUserWithHeal()')
    expect(src).not.toMatch(/async function resolveUser\(/)
  })

  it('heal route is exempt from the onboarding gate (no raw 403 JSON in browser)', () => {
    const fs = require('node:fs')
    const path = require('node:path')
    const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'onboarding.ts'), 'utf8')
    expect(src).toContain("'/api/auth/heal-role'")
  })
})
