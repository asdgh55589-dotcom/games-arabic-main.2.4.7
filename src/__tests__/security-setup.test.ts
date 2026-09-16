/**
 * P0-flexible security setup: optional password / optional email / skip.
 *
 * - needsSecuritySetup helper: true when no password OR synthetic email.
 * - setup-password accepts password-only, email-only, or both (>= 1 required).
 * - login-identifier allows username-or-email + password login (role-cookie
 *   session, same class as Telegram sessions — no Supabase involvement).
 * - Banner is dismissible per session (sessionStorage) with the new copy.
 * - Setup card shows the recovery warning and skip note.
 *
 * Node test env has no jsdom, so component contracts are asserted by
 * reading source (repo convention, see official-login.test.ts).
 */
import * as fs from 'fs'
import * as path from 'path'
import { isSyntheticTelegramEmail, needsSecuritySetup } from '@/lib/onboarding'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('needsSecuritySetup helper', () => {
  it('true for OAuth-only users (no password, real email)', () => {
    expect(needsSecuritySetup({ hasPassword: false, email: 'g@mail.com' })).toBe(true)
  })

  it('true for Telegram users without email (synthetic)', () => {
    expect(needsSecuritySetup({ hasPassword: false, email: 'telegram_1@telegram.local' })).toBe(
      true,
    )
  })

  it('true when password exists but email is still synthetic', () => {
    expect(needsSecuritySetup({ hasPassword: true, email: 'telegram_1@telegram.local' })).toBe(
      true,
    )
  })

  it('false when password + real email are both set', () => {
    expect(needsSecuritySetup({ hasPassword: true, email: 'g@mail.com' })).toBe(false)
  })

  it('fail-safe: unknown state prompts setup', () => {
    expect(needsSecuritySetup({})).toBe(true)
    expect(needsSecuritySetup({ hasPassword: undefined, email: undefined })).toBe(true)
  })

  it('agrees with isSyntheticTelegramEmail for telegram identities', () => {
    expect(isSyntheticTelegramEmail('telegram_9@telegram.local')).toBe(true)
    expect(isSyntheticTelegramEmail('user@mail.com')).toBe(false)
  })
})

describe('setup banner contract (dismissible, new copy)', () => {
  const BANNER = read('components/auth/password-setup-banner.tsx')

  it('shows the new reminder copy with a link to settings', () => {
    expect(BANNER).toContain('لحماية حسابك، ننصح بتعيين كلمة مرور وبريد إلكتروني')
    expect(BANNER).toContain('/settings?section=account')
  })

  it('is dismissible per session and reappears on next login', () => {
    expect(BANNER).toContain('sessionStorage')
    expect(BANNER).toContain('ga-setup-banner-dismissed')
  })

  it('gates on needsSecuritySetup (not just hasPassword)', () => {
    expect(BANNER).toContain('needsSecuritySetup')
  })

  it('never blocks navigation (no redirect, conditional render only)', () => {
    expect(BANNER).not.toMatch(/window\.location/)
    expect(BANNER).not.toMatch(/redirect\(/)
  })
})

describe('setup card contract (optional fields + warning)', () => {
  const CARD = read('components/settings/setup-password-card.tsx')

  it('shows the recovery warning regardless of input', () => {
    expect(CARD).toContain('بدون بريد إلكتروني مؤكد، لن تستطيع استرجاع حسابك')
  })

  it('states the setup is optional and skippable', () => {
    expect(CARD).toContain('اختياري')
  })

  it('supports email-only mode (no password required when one exists)', () => {
    expect(CARD).toContain('hasPassword')
  })
})

describe('username-or-email login wiring', () => {
  const FORM = read('components/official-login/login-form.tsx')
  const ROUTE = read('app/api/auth/login-identifier/route.ts')

  it('login form routes non-email identifiers to the identifier endpoint', () => {
    expect(FORM).toContain('/api/auth/login-identifier')
  })

  it('identifier endpoint uses generic errors + Neon hash + role cookie + ledger', () => {
    for (const token of [
      'LOGIN_GENERIC_ERROR',
      'bcrypt',
      'setRoleCookie',
      'createSessionLedger',
      'getBanStatus',
    ]) {
      expect(ROUTE).toContain(token)
    }
  })

  it('identifier endpoint does not require a staff security key or Supabase session', () => {
    expect(ROUTE).not.toContain('securityKey')
    expect(ROUTE).not.toContain('signInWithPassword')
  })

  it('identifier endpoint has no member-role block (it IS the member password path)', () => {
    expect(ROUTE).not.toContain('Insufficient permissions')
  })
})
