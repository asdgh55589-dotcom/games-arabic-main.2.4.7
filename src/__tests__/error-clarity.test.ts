/**
 * Section 3 regression: error clarity (items 16-22).
 * Static pins (repo convention) + functional checks of the message map.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8')

describe('section 3: scoped boundaries exist with aria + session logging (17/18/20/21/22)', () => {
  it.each([
    ['src/app/creator/error.tsx', 'creator-error', 'تعذّر تحميل الاستوديو'],
    ['src/app/settings/error.tsx', 'settings-error', 'تعذّر تحميل الإعدادات'],
    ['src/app/login/error.tsx', 'login-error', 'تعذّر تحميل صفحة الدخول'],
    ['src/app/admin/error.tsx', 'admin-error', 'تعذّر تحميل لوحة التحكم'],
    ['src/app/error.tsx', 'app-error', 'تعذّر تحميل الصفحة'],
    ['src/app/global-error.tsx', 'global-error', 'تعذّر تحميل الصفحة'],
  ])('%s has message + retry + aria + logging', (file, route, heading) => {
    const src = read(file)
    expect(src).toContain("'use client'")
    expect(src).toContain(heading)
    expect(src).toContain('إعادة المحاولة')
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('reportError')
    expect(src).toContain(`route: '${route}'`)
  })

  it('auth-adjacent boundaries attach session context (login boundary exempt by design)', () => {
    for (const f of [
      'src/app/creator/error.tsx',
      'src/app/settings/error.tsx',
      'src/app/admin/error.tsx',
      'src/app/error.tsx',
    ]) {
      expect(read(f)).toMatch(/userId: user\?\.id/)
    }
    expect(read('src/app/login/error.tsx')).toContain('no authenticated session is expected')
  })
})

describe('section 3: specific auth messages (item 16)', () => {
  it('admin login splits no_session from auth_failed', () => {
    const src = read('src/app/admin/login/client.tsx')
    expect(src).toMatch(/errorCode === 'no_session'/)
    expect(src).toContain('انتهت جلستك، سجّل دخولك من جديد.')
  })

  it('public login maps all four callback codes', () => {
    const src = read('src/app/login/page.tsx')
    for (const code of ['no_session', 'banned', 'email_exists_link_accounts', 'auth_failed']) {
      expect(src).toContain(`'${code}'`)
    }
    expect(src).toContain('انتهت جلستك، سجّل دخولك من جديد')
  })

  it('message map has the MSA session message + non-generic fallback', () => {
    const { getAuthErrorMessage, AUTH_ERRORS } = require('@/lib/auth/errors') as typeof import(
      '@/lib/auth/errors'
    )
    expect(AUTH_ERRORS.SESSION_EXPIRED).toBe('انتهت جلستك، سجّل دخولك من جديد')
    expect(getAuthErrorMessage('SESSION_EXPIRED')).toBe('انتهت جلستك، سجّل دخولك من جديد')
    expect(getAuthErrorMessage('NO_SUCH_CODE')).toBe('حدث خطأ غير متوقع — حاول مجدداً')
  })

  it('login route no longer returns the barest generics', () => {
    const src = read('src/app/api/auth/login/route.ts')
    expect(src).not.toContain("forbidden('صلاحيات غير كافية')")
    expect(src).not.toContain("internalError('حدث خطأ، حاول مجدداً')")
  })
})
