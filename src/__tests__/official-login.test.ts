/**
 * Invariant tests for the login-03 redesign (D.C).
 *
 * React components can't render under the node test env (no jsdom), so these
 * tests assert the load-bearing contracts by reading source: isolation from
 * the customized ui/, registry fidelity, RTL+Arabic, and real-auth wiring.
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
    for (const f of ['button', 'card', 'input', 'label']) {
      const src = read(`components/official-ui/${f}.tsx`)
      expect(src).not.toMatch(/@\/components\//)
      expect(src).not.toMatch(/@\/lib\//)
      expect(src).toMatch(/from ['"]\.\/utils['"]/)
    }
  })
})

describe('login-03 registry fidelity', () => {
  it('keeps the official structure (Card shell, two OAuth buttons, divider, email form, terms)', () => {
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

describe('Arabic + real-auth wiring', () => {
  it('is Arabic-first', () => {
    for (const s of ['مرحباً بعودتك', 'الدخول عبر Google', 'الدخول عبر Telegram', 'نسيت كلمة المرور؟']) {
      expect(FORM).toContain(s)
    }
  })

  it('wires Google OAuth via Supabase with the real callback', () => {
    expect(FORM).toContain("provider: 'google'")
    expect(FORM).toContain('/api/auth/callback')
  })

  it('wires Telegram deep-link + polling + ledger', () => {
    expect(FORM).toContain("fetch('/api/auth/telegram'")
    expect(FORM).toContain('/api/auth/telegram/poll?token=')
    expect(FORM).toContain("fetch('/api/auth/session-ledger'")
  })

  it('wires email login/register with pending-verification + resend', () => {
    expect(FORM).toContain('signInWithPassword')
    expect(FORM).toContain('signUp')
    expect(FORM).toContain('/api/auth/register-ledger')
    expect(FORM).toContain('/api/auth/send-verification-email')
  })

  it('links recovery, terms, and privacy (all exist as routes)', () => {
    expect(FORM).toContain('href="/recover"')
    expect(FORM).toContain('href="/terms"')
    expect(FORM).toContain('href="/privacy"')
    expect(fs.existsSync(path.join(ROOT, 'app/recover/page.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(ROOT, 'app/reset-password/page.tsx'))).toBe(true)
  })

  it('keeps the /login URL with noindex metadata', () => {
    expect(ROUTE).toContain('OfficialLoginPage')
    expect(ROUTE).toContain('index: false')
  })
})

describe('signup username oracle closed (Phase 4B Fix 3)', () => {
  it('performs no pre-signup username-existence probe', () => {
    // The old fetch(`/api/users/${...}/profile`) let anyone enumerate names.
    expect(FORM).not.toMatch(/api\/users\/.*\/profile/)
    expect(FORM).not.toMatch(/\/api\/users\//)
  })

  it('handles server-side 409 conflicts after a real signup attempt', () => {
    expect(FORM).toMatch(/register-ledger/)
    expect(FORM).toMatch(/status === 409/)
    expect(FORM).toMatch(/USERNAME_TAKEN/)
  })

  it('conflict warning is generic and actionable (no reason oracle)', () => {
    expect(FORM).toMatch(/يمكنك تغييره لاحقاً من الإعدادات/)
  })
})
