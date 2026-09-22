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

  it('true when the real email is still unverified', () => {
    expect(
      needsSecuritySetup({ hasPassword: true, email: 'g@mail.com', emailVerified: false }),
    ).toBe(true)
  })

  it('false once the real email is verified', () => {
    expect(
      needsSecuritySetup({ hasPassword: true, email: 'g@mail.com', emailVerified: true }),
    ).toBe(false)
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
    expect(CARD).toContain('للاسترجاع فقط')
    expect(CARD).toContain('لن تستطيع استرجاع حسابك')
  })

  it('states the setup is optional and skippable', () => {
    expect(CARD).toContain('اختياري')
  })

  it('supports email-only mode (no password required when one exists)', () => {
    expect(CARD).toContain('hasPassword')
  })

  it('shows verification status with resend affordance', () => {
    expect(CARD).toContain('بانتظار التأكيد')
    expect(CARD).toContain('/api/auth/verify-email/resend')
    expect(CARD).toContain('تم إرسال رابط التحقق إلى بريدك الإلكتروني')
  })
})

describe('username-or-email login disabled (Google only)', () => {  const FORM = read('components/official-login/login-form.tsx')
  const ROUTE = read('app/api/auth/login-identifier/route.ts')

  it('login form offers no identifier endpoint', () => {
    expect(FORM).not.toContain('/api/auth/login-identifier')
  })

  it('identifier endpoint is a 410 disabled stub', () => {
    expect(ROUTE).toContain('LOGIN_METHOD_DISABLED')
    expect(ROUTE).toContain('410')
    for (const token of [
      'LOGIN_GENERIC_ERROR',
      'bcrypt',
      'setRoleCookie',
      'createSessionLedger',
      'getBanStatus',
    ]) {
      expect(ROUTE).not.toContain(token)
    }
  })

  it('identifier endpoint has no staff security key or Supabase session', () => {
    expect(ROUTE).not.toContain('securityKey')
    expect(ROUTE).not.toContain('signInWithPassword')
  })

  it('identifier endpoint has no member-role block (it answers 410 to all)', () => {
    expect(ROUTE).not.toContain('Insufficient permissions')
  })
})

describe('account settings UX contracts (clear labels + states)', () => {
  const CARD = read('components/settings/setup-password-card.tsx')
  const SETTINGS = read('views/settings.tsx')
  const VERIFY_PAGE = read('views/verify-email-address.tsx')

  it('email field is labeled as optional-secondary with a why-helper', () => {
    expect(CARD).toContain('البريد الإلكتروني (اختياري — للاسترجاع فقط)')
    expect(CARD).toContain('لن تصلك إشعارات على البريد')
    expect(CARD).toContain('required')
  })

  it('password block uses set-password labels for passwordless users', () => {
    expect(CARD).toContain('قم بتعيين كلمة مرور')
    expect(CARD).toContain('كلمة المرور الجديدة')
    expect(CARD).toContain('تأكيد كلمة المرور')
  })

  it('shows the full success message after email send (inbox + spam guidance)', () => {
    expect(CARD).toContain('تم إرسال رابط التحقق إلى بريدك الإلكتروني')
    expect(CARD).toContain('الرسائل غير المرغوب فيها')
  })

  it('surfaces send failures instead of failing silently', () => {
    expect(CARD).toContain('تعذر إرسال رسالة التحقق. يرجى المحاولة لاحقًا.')
    expect(CARD).toContain('verificationSent')
  })

  it('resend has a 60s cooldown with countdown and confirmation', () => {
    expect(CARD).toContain('لم تصلك الرسالة؟')
    expect(CARD).toContain('RESEND_COOLDOWN_MS')
    expect(CARD).toContain('بعد')
    expect(CARD).toContain('تم إعادة إرسال رسالة التحقق')
  })

  it('covers every email state explicitly', () => {
    expect(CARD).toContain('لم يتم إضافة بريد إلكتروني بعد')
    expect(CARD).toContain('بانتظار التأكيد - تحقق من بريدك')
    expect(CARD).toContain('بريدك الإلكتروني مؤكد')
  })

  it('change-password card is contextual with a no-password state', () => {
    expect(SETTINGS).toContain('لم يتم تعيين كلمة مرور بعد')
    expect(SETTINGS).toContain('تم تغيير كلمة المرور بنجاح')
    expect(SETTINGS).toContain('تعذر تغيير كلمة المرور')
    expect(SETTINGS).toContain('user?.hasPassword')
  })

  it('verify page names expiry explicitly', () => {
    expect(VERIFY_PAGE).toContain('انتهت صلاحية رابط التحقق')
  })
})
