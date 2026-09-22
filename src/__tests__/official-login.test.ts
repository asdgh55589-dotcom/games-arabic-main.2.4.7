/**
 * Invariant tests for the Google-only login (owner decision).
 *
 * Manual email/username login and Telegram login are hidden AND disabled
 * server-side. React components can't render under the node test env (no
 * jsdom), so these tests assert the load-bearing contracts by reading
 * source: isolation from the customized ui/, registry fidelity, RTL+Arabic,
 * Google-only wiring, and absence of the disabled methods.
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const FORM = read('components/official-login/login-form.tsx')
const PAGE = read('components/official-login/login-page.tsx')
const ROUTE = read('app/login/page.tsx')
const GLOBALS = read('app/globals.css')

describe('official-login isolation', () => {
  it('imports primitives only from official-ui (never the customized ui/)', () => {
    for (const [name, src] of [
      ['login-form', FORM],
      ['login-page', PAGE],
    ] as const) {
      expect(src).not.toMatch(/@\/components\/ui\//)
      expect(src).not.toMatch(/@\/views\//)
      void name
    }
  })

  it('official-ui primitives are self-contained (only ./utils + external deps)', () => {
    for (const f of ['button', 'card', 'label']) {
      const src = read(`components/official-ui/${f}.tsx`)
      expect(src).not.toMatch(/@\/components\//)
      expect(src).not.toMatch(/@\/lib\//)
      expect(src).toMatch(/from ['"]\.\/utils['"]/)
    }
  })
})

describe('login-03 registry fidelity', () => {
  it('keeps the official structure (Card shell, OAuth button, terms)', () => {
    for (const token of [
      'CardHeader',
      'CardTitle',
      'CardDescription',
      'CardContent',
      'bg-muted',
      'min-h-svh',
      'max-w-sm',
    ]) {
      expect(FORM + PAGE).toContain(token)
    }
  })

  it('renders inside the scoped official theme with RTL direction', () => {
    expect(PAGE).toContain('official-login-scope')
    expect(PAGE).toContain('dir="rtl"')
  })

  it('ships the scoped zinc-light theme vars', () => {
    const scope = GLOBALS.slice(GLOBALS.indexOf('.official-login-scope'))
    for (const v of ['--background', '--foreground', '--primary', '--muted', '--border', '--ring']) {
      expect(scope).toContain(v)
    }
  })
})

describe('Arabic + Google-only wiring', () => {
  it('is Arabic-first with Google as the only method', () => {
    for (const s of ['مرحباً بك', 'الدخول عبر Google']) {
      expect(FORM).toContain(s)
    }
  })

  it('offers no Telegram entry point', () => {
    expect(FORM).not.toMatch(/Telegram/i)
    expect(FORM).not.toContain('/api/auth/telegram')
  })

  it('offers no manual email/username form', () => {
    expect(FORM).not.toContain('signInWithPassword')
    expect(FORM).not.toContain('signUp')
    expect(FORM).not.toContain('/api/auth/register-ledger')
    expect(FORM).not.toContain('/api/auth/login-identifier')
    expect(FORM).not.toContain('نسيت كلمة المرور؟')
  })

  it('wires Google OAuth via Supabase with the real callback', () => {
    expect(FORM).toContain("provider: 'google'")
    expect(FORM).toContain('/api/auth/callback')
  })

  it('links terms and privacy', () => {
    expect(FORM).toContain('href="/terms"')
    expect(FORM).toContain('href="/privacy"')
  })

  it('keeps the /login URL with noindex metadata', () => {
    expect(ROUTE).toContain('OfficialLoginPage')
    expect(ROUTE).toContain('index: false')
  })
})

describe('disabled methods stay disabled server-side', () => {
  it('login-identifier rejects with 410', () => {
    const src = read('app/api/auth/login-identifier/route.ts')
    expect(src).toContain('LOGIN_METHOD_DISABLED')
    expect(src).toMatch(/410/)
  })

  it('register-ledger rejects with 410', () => {
    const src = read('app/api/auth/register-ledger/route.ts')
    expect(src).toContain('LOGIN_METHOD_DISABLED')
    expect(src).toMatch(/410/)
  })

  it('telegram login entry points reject with 410', () => {
    for (const p of [
      'app/api/auth/telegram/route.ts',
      'app/api/auth/telegram/poll/route.ts',
      'app/api/auth/telegram/callback/route.ts',
    ]) {
      const src = read(p)
      expect(src).toContain('LOGIN_METHOD_DISABLED')
      expect(src).toMatch(/410/)
    }
  })

  it('Google callback auto-verifies email for existing users', () => {
    const src = read('app/api/auth/callback/route.ts')
    expect(src).toContain('emailVerified')
    expect(src).toMatch(/provider === 'google'/)
  })
})
