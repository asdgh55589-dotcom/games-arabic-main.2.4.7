/**
 * Phase 4C (owner requirements): user-facing optional MFA + design consistency.
 *
 * React components can't render under the node test env (no jsdom), so UI
 * contracts are asserted by reading source (same pattern as
 * official-login.test.ts); behavior is covered by API route tests
 * (mfa-member-challenge, mfa-disable-proof, mfa-recovery-token).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const SETTINGS = read('views/settings.tsx')
const MFA_SETUP = read('components/settings/mfa-setup.tsx')
const MFA_MANAGE = read('components/settings/mfa-manage.tsx')
const LOGIN_FORM = read('components/official-login/login-form.tsx')
const IDENTIFIER_ROUTE = read('app/api/auth/login-identifier/route.ts')

describe('Part 1: MFA in Settings (optional)', () => {
  it('settings has an "الأمان" security tab', () => {
    expect(SETTINGS).toContain("'security'")
    expect(SETTINGS).toContain('الأمان')
    expect(SETTINGS).toContain('المصادقة الثنائية والجلسات النشطة')
  })

  it('security tab wires MFA setup + manage + sessions link', () => {
    expect(SETTINGS).toContain('MfaSetup')
    expect(SETTINGS).toContain('MfaManage')
    expect(SETTINGS).toContain('/settings/sessions')
    expect(SETTINGS).toContain('الجلسات النشطة')
    expect(SETTINGS).toContain('/api/auth/mfa/status')
  })

  it('setup flow covers QR → verify → recovery codes → confirm-saved', () => {
    for (const token of [
      '/api/auth/mfa/setup',
      '/api/auth/mfa/verify',
      'qrCode',
      'recoveryCodes',
      'حفظت الرموز في مكان آمن',
      'امسح الرمز',
    ]) {
      expect(MFA_SETUP).toContain(token)
    }
  })

  it('manage covers status + regenerate (TOTP proof) + disable (step-up proof)', () => {
    for (const token of [
      '/api/auth/mfa/disable',
      '/api/auth/mfa/verify',
      'آخر تحقق',
      'رموز الاسترداد المتبقية',
      'مفعّلة منذ',
      'تأكيد التعطيل',
    ]) {
      expect(MFA_MANAGE).toContain(token)
    }
  })

  it('login stays optional: challenge ONLY when totpEnabled, others unchanged', () => {
    expect(IDENTIFIER_ROUTE).toContain('mfaRequired')
    expect(IDENTIFIER_ROUTE).toContain('totpEnabled')
    // Full session path intact for non-MFA users.
    expect(IDENTIFIER_ROUTE).toContain('setRoleCookie')
    expect(IDENTIFIER_ROUTE).toContain('createSessionLedger')
  })

  it('login form renders the TOTP second step with recovery fallback', () => {
    for (const token of [
      'mfaPending',
      '/api/auth/mfa/login',
      '/api/auth/mfa/recovery',
      '/api/auth/mfa/challenge',
      'رجوع لتسجيل الدخول',
    ]) {
      expect(LOGIN_FORM).toContain(token)
    }
  })
})

describe('Part 2b: sessions discoverability', () => {
  it('settings security tab links to /settings/sessions', () => {
    expect(SETTINGS).toMatch(/href="\/settings\/sessions"/)
  })
})

describe('Part 2c: single verify-email system', () => {
  it('legacy view is gone; /verify-email redirects canonically', () => {
    expect(fs.existsSync(path.join(ROOT, 'views/verify-email.tsx'))).toBe(false)
    expect(read('app/verify-email/page.tsx')).toContain("redirect('/verify-email-address')")
  })

  it('canonical page handles tokens + keeps the Supabase resend path', () => {
    const V = read('views/verify-email-address.tsx')
    expect(V).toContain('/api/auth/verify-email')
    expect(V).toContain('supabase.auth.resend(')
  })
})

describe('Part 2d: consistent toasts', () => {
  it('recover, reset-password, verify-address all use useToast', () => {
    for (const f of [
      'views/recover.tsx',
      'views/reset-password.tsx',
      'views/verify-email-address.tsx',
    ]) {
      expect(read(f)).toContain('useToast')
    }
  })

  it('reset-password toasts success (not only failure)', () => {
    expect(read('views/reset-password.tsx')).toContain('تم تعيين كلمة المرور الجديدة')
  })
})

describe('Part 2a/2f: Arabic user-facing strings', () => {
  it('ban messages are Arabic in both login routes', () => {
    for (const f of [
      'app/api/auth/login/route.ts',
      'app/api/auth/login-identifier/route.ts',
    ]) {
      const src = read(f)
      expect(src).toContain('تم حظر حسابك')
      expect(src).not.toContain('temporarily banned')
      expect(src).not.toContain('permanently banned')
    }
  })

  it('no English "Too many requests" bodies remain in auth API', () => {
    const files = [
      'app/api/auth/recover/route.ts',
      'app/api/auth/change-password/route.ts',
      'app/api/auth/reset-password/route.ts',
      'app/api/auth/setup-password/route.ts',
      'app/api/auth/verify-email/route.ts',
      'app/api/auth/verify-email/resend/route.ts',
      'app/api/auth/login/route.ts',
      'app/api/auth/login-identifier/route.ts',
    ]
    for (const f of files) {
      expect(read(f)).not.toContain('Too many requests')
    }
  })

  it('staff-login internal errors are Arabic', () => {
    expect(read('app/api/auth/login/route.ts')).not.toContain('Account not found in auth system')
    expect(read('app/api/auth/login/route.ts')).not.toContain('Login failed after account creation')
  })
})

describe('Part 2e: auth views share container + touch-target standards', () => {
  it('recover/reset/verify-address use centered containers + 44px primary buttons', () => {
    for (const f of [
      'views/recover.tsx',
      'views/reset-password.tsx',
      'views/verify-email-address.tsx',
    ]) {
      const src = read(f)
      expect(src).toMatch(/max-w-(md|xl)/)
      expect(src).toContain('min-h-[44px]')
    }
  })

  it('Arabic helper text uses relaxed line-height', () => {
    for (const f of ['views/recover.tsx', 'views/reset-password.tsx']) {
      expect(read(f)).toMatch(/leading-[67]/)
    }
  })
})
