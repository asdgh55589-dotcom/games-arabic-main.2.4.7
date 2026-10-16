/**
 * Section 2 regression: middleware scope, redirect status, path preservation.
 * Style follows the repo's static-source proxy tests (mfa-hardening,
 * creator-studio-access) + functional checks of the exported helpers
 * (precedent: getRoleFromCookie "exported for tier tests").
 */
process.env.JWT_SECRET = 'test-secret-key-for-jest-32-chars!'

import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const proxySrc = fs.readFileSync(path.join(ROOT, 'src', 'proxy.ts'), 'utf8')

// proxy.ts requires JWT_SECRET at import — set above before the lazy require.
const { isAdminPath, isApiAdminPath } = require('@/proxy') as typeof import('@/proxy')

describe('section 2: /admin scope matching (items 8/10/15)', () => {
  it.each(['/admin', '/admin/', '/admin/users', '/admin/login', '/admin/login/'])(
    '%s is an admin path',
    (p) => {
      expect(isAdminPath(p)).toBe(true)
    },
  )

  it.each(['/adminfoo', '/administrator', '/', '/login', '/api/adminfoo'])(
    '%s is NOT an admin path',
    (p) => {
      expect(isAdminPath(p)).toBe(false)
    },
  )

  it.each(['/api/admin', '/api/admin/', '/api/admin/users'])('%s is an api-admin path', (p) => {
    expect(isApiAdminPath(p)).toBe(true)
  })

  it.each(['/api/adminfoo', '/api/administrator', '/api/auth/login'])(
    '%s is NOT an api-admin path',
    (p) => {
      expect(isApiAdminPath(p)).toBe(false)
    },
  )

  it('trailing-slash login stays exempt (exact-match bypass closed)', () => {
    expect(proxySrc).toMatch(/PUBLIC_ADMIN_PATHS\.includes\(normalizePathname\(pathname\)\)/)
  })
})

describe('section 2: redirect status + path preservation (items 12/13)', () => {
  it('auth redirects use explicit 307 (no-cache); only the SPA migration stays 301', () => {
    const explicit307 = proxySrc.match(/NextResponse\.redirect\(.*?, 307\)/g) || []
    expect(explicit307.length).toBeGreaterThanOrEqual(9)
    expect(proxySrc).toMatch(/new URL\(destination, req\.url\), 301/)
    // no bare default-status auth redirect remains
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(loginUrl\)/)
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(onboardingUrl\)/)
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(becomeUrl\)/)
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(dashboardUrl\)/)
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(securityUrl\)/)
    expect(proxySrc).not.toMatch(/NextResponse\.redirect\(new URL\(target, req\.url\)\)/)
  })

  it('ledger/token/mfa redirects preserve ?from for post-login return', () => {
    expect(proxySrc).toMatch(/loginUrl\.searchParams\.set\('from', pathname\)/)
    expect(proxySrc).toMatch(/securityUrl\.searchParams\.set\('from', pathname\)/)
  })
})

describe('section 2: single staff vocabulary (item 11)', () => {
  it('admin gates use the central isStaff instead of inline arrays', () => {
    expect(proxySrc).toMatch(/from '@\/lib\/roles'/)
    expect(proxySrc).toMatch(/isStaff\(rolePayload\.role\)/)
    expect(proxySrc).not.toMatch(/\['moderator', 'admin', 'manager', 'owner'\]\.includes/)
  })
})
