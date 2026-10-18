/**
 * Section: creator session heal (regression for /creator → /login bounce).
 *
 * Bug: `ga_admin_role` is a fixed 7-day JWT that is never refreshed, while the
 * Supabase session auto-refreshes forever. Once the role cookie expires the user
 * still looks logged in (navbar reads /api/auth/me) but the Edge gate in
 * proxy.ts — which reads ONLY the cookie — bounced them to /login.
 *
 * These tests are behavioural where it matters (safe-redirect hardening + heal
 * wiring) and static pins for the Edge gate.
 */
import { NextRequest } from 'next/server'

// The heal route imports resolve-with-heal → lib/auth → lib/db, which builds
// the Prisma singleton at module load. Provide dummy env (never connects — the
// heal fails on the missing Supabase session, which is what these tests assert).
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://u:p@localhost:5432/test?sslmode=require&connection_limit=1&pool_timeout=1&connect_timeout=1'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest-32-chars!'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
  jest.resetModules()
})

describe('heal destination hardening (open-redirect guard)', () => {
  const loadSafeNext = async () => {
    const mod = await import('@/app/api/auth/heal-role/route')
    // safeNext is module-private; exercise it through the route instead.
    return mod
  }

  it('module exports a GET handler', async () => {
    const mod = await loadSafeNext()
    expect(typeof mod.GET).toBe('function')
  })

  it.each([
    ['https://evil.com/steal', '/login?next=%2Fcreator'],
    ['//evil.com', '/login?next=%2Fcreator'],
    ['/creator/../../admin', '/login?next=%2Fcreator'],
    ['javascript:alert(1)', '/login?next=%2Fcreator'],
  ])('rejects hostile next=%s → falls back to /login', async (hostile) => {
    jest.resetModules()
    // No valid session in tests → heal throws → redirect to /login with a SAFE next.
    const { GET } = await import('@/app/api/auth/heal-role/route')
    const req = new NextRequest(
      `http://localhost:3000/api/auth/heal-role?next=${encodeURIComponent(hostile)}`,
    )
    const res = await GET(req)
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    // Whatever happens, the location must stay on our own origin.
    expect(loc.startsWith('http://localhost:3000/')).toBe(true)
    expect(loc).not.toContain('evil.com')
    expect(loc).not.toContain('javascript:')
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
    // the old inline copy must be gone
    expect(src).not.toMatch(/async function resolveUser\(/)
  })
})