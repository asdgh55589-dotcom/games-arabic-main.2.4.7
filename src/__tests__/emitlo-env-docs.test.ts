/**
 * Phase 3 Task C (SA-3): Emitlo env + docs + cleanup verification.
 *
 * Static only — no network, no DB, no real emails, no secrets.
 * - .env.example: EMITLO_API_KEY + EMITLO_API_URL + uncommented
 *   EMAIL_FROM=noreply@games-arabic.com, zero RESEND_API_KEY.
 * - package.json: conditional — if "resend" still present (SA-1 scope),
 *   warn + pass; else assert absent.
 * - 8 docs files: zero /resend/i + zero EMAIL_FROM_ADDRESS.
 * - Supabase whitelist: supabase.auth.resend call sites MUST remain present.
 */
import * as fs from 'fs'
import * as path from 'path'

const ROOT = process.cwd()
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const DOCS = [
  'TECHNICAL.md',
  'docs/DEPLOYMENT.md',
  'docs/AUTH_SETUP.md',
  'README.md',
  'docs/DEVELOPMENT-GUIDE.md',
  'AGENTS.md',
  'docs/NOTIFICATION_ARCHITECTURE.md',
  'docs/phase4-creator-program-staging.md',
] as const

describe('.env.example email block (SA-3)', () => {
  const env = read('.env.example')

  it('contains EMITLO_API_KEY placeholder', () => {
    expect(env).toContain('EMITLO_API_KEY=')
  })

  it('contains EMITLO_API_URL with api.emitlo.com default', () => {
    expect(env).toContain('EMITLO_API_URL')
    expect(env).toContain('https://api.emitlo.com')
  })

  it('has uncommented EMAIL_FROM=noreply@games-arabic.com', () => {
    expect(env.split('\n')).toContain('EMAIL_FROM="noreply@games-arabic.com"')
  })

  it('has zero RESEND_API_KEY', () => {
    expect(env).not.toContain('RESEND_API_KEY')
  })

  it('has zero EMAIL_FROM_ADDRESS phantom', () => {
    expect(env).not.toContain('EMAIL_FROM_ADDRESS')
  })
})

describe('package.json resend dependency (SA-1 scope, conditional)', () => {
  it('warns + passes when resend still present; asserts absent otherwise', () => {
    const pkg = read('package.json')
    if (pkg.includes('"resend"')) {
      // eslint-disable-next-line no-console
      console.warn(
        '[SA-3 info] "resend" still in package.json — SA-1 removal pending; skipping hard assert',
      )
      expect(true).toBe(true)
    } else {
      expect(pkg).not.toMatch(/resend/i)
    }
  })
})

describe('docs provider rename Resend→Emitlo (SA-3)', () => {
  it.each([...DOCS])('%s has zero /resend/i', (f) => {
    expect(read(f)).not.toMatch(/resend/i)
  })

  it.each([...DOCS])('%s has zero EMAIL_FROM_ADDRESS phantom', (f) => {
    expect(read(f)).not.toContain('EMAIL_FROM_ADDRESS')
  })

  it('phase4 staging doc carries the Emitlo staging checklist', () => {
    const staging = read('docs/phase4-creator-program-staging.md')
    expect(staging).toContain('EMITLO_API_KEY')
    expect(staging).toContain('SPF/DKIM')
    expect(staging).toContain('Test email arrives')
    expect(staging).toContain('approval email arrives')
    expect(staging).toContain('reset email arrives')
  })
})

describe('supabase.auth.resend whitelist (MUST remain — do NOT touch)', () => {
  it('send-verification-email route keeps supabase.auth.resend + keyPrefix', () => {
    const src = read('src/app/api/auth/send-verification-email/route.ts')
    expect(src).toContain('supabase.auth.resend(')
    expect(src).toContain("keyPrefix: 'auth:resend-verify'")
  })

  it('Google-only login-form has no verification resend (no verification messages)', () => {
    expect(read('src/components/official-login/login-form.tsx')).not.toContain(
      'supabase.auth.resend(',
    )
  })

  it('verify-email view keeps supabase.auth.resend', () => {
    // Phase 4C merge: legacy views/verify-email.tsx folded into -address.
    expect(read('src/views/verify-email-address.tsx')).toContain('supabase.auth.resend(')
  })
})
