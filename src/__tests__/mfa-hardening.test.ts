/**
 * Audit D.2 MFA hardening: no hardcoded fallback secret, real AES-256-GCM
 * for TOTP secrets at rest (env-derived key, legacy base64 readable),
 * proxy MFA enforcement active for /admin* + /api/admin*.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const OLD_ENV = process.env.JWT_SECRET

beforeEach(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!!'
  jest.resetModules()
})

afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = OLD_ENV
  jest.resetModules()
})

describe('mfa-token secret (static)', () => {
  it('has no hardcoded default secret', () => {
    const src = read('lib/mfa-token.ts')
    expect(src).not.toMatch(/fallback-mfa-secret/)
    expect(src).not.toMatch(/\|\|\s*['"][^'"]+['"]/)
  })
})

describe('TOTP secret encryption (AES-256-GCM)', () => {
  it('roundtrips and is really encrypted (not base64)', async () => {
    const { encryptTOTPSecret, decryptTOTPSecret } = await import('@/lib/totp')
    const secret = 'JBSWY3DPEHPK3PXP'
    const enc = encryptTOTPSecret(secret)
    expect(enc).not.toBe(Buffer.from(secret).toString('base64'))
    expect(decryptTOTPSecret(enc)).toBe(secret)
  })

  it('two encryptions differ (random IV)', async () => {
    const { encryptTOTPSecret } = await import('@/lib/totp')
    expect(encryptTOTPSecret('JBSWY3DPEHPK3PXP')).not.toBe(encryptTOTPSecret('JBSWY3DPEHPK3PXP'))
  })

  it('wrong key fails closed', async () => {
    const { encryptTOTPSecret } = await import('@/lib/totp')
    const enc = encryptTOTPSecret('JBSWY3DPEHPK3PXP')
    process.env.JWT_SECRET = 'a-different-32-char-secret-value!'
    const { decryptTOTPSecret } = await import('@/lib/totp')
    expect(() => decryptTOTPSecret(enc)).toThrow()
  })

  it('legacy base64 rows still decrypt (migration compat)', async () => {
    const { decryptTOTPSecret } = await import('@/lib/totp')
    expect(decryptTOTPSecret(Buffer.from('JBSWY3DPEHPK3PXP').toString('base64'))).toBe(
      'JBSWY3DPEHPK3PXP',
    )
  })

  it('missing JWT_SECRET fails closed (no silent fallback)', async () => {
    delete process.env.JWT_SECRET
    const { encryptTOTPSecret } = await import('@/lib/totp')
    expect(() => encryptTOTPSecret('JBSWY3DPEHPK3PXP')).toThrow()
  })
})

describe('proxy MFA enforcement (static)', () => {
  it('admin pages redirect unverified staff to setup (not commented)', () => {
    const proxy = read('proxy.ts')
    expect(proxy).toMatch(/mfa_required/)
    expect(proxy).not.toMatch(/\/\/\s*if\s*\(!rolePayload\.mfaVerified/)
  })

  it('admin API rejects unverified callers with MFA_REQUIRED (not commented)', () => {
    const proxy = read('proxy.ts')
    expect(proxy).toMatch(/MFA_REQUIRED/)
  })
})
