/**
 * src/lib/auth/errors.ts — خريطة أخطاء المصادقة بالعربية (للـ UI لاحقاً)
 * Phase 1: تعريف فقط، لا ربط واجهة بعد
 */
export const AUTH_ERRORS: Record<string, string> = {
  USERNAME_TAKEN: 'اسم المستخدم محجوز، جرّب اسم تاني',
  EMAIL_TAKEN: 'الإيميل ده مسجل بالفعل',
  WEAK_PASSWORD: 'كلمة المرور ضعيفة (٨ أحرف على الأقل)',
  INVALID_EMAIL: 'الإيميل مش صحيح',
  EMAIL_NOT_VERIFIED: 'لازم تأكد إيميلك الأول — افتح بريدك',
  WRONG_PASSWORD: 'بيانات الدخول مش صحيحة',
  USER_BANNED: 'الحساب ده موقوف',
  TELEGRAM_FAILED: 'فشل التحقق من تليجرام، جرّب تاني',
  GOOGLE_FAILED: 'فشل الدخول بجوجل، جرّب تاني',
  SESSION_EXPIRED: 'انتهت الجلسة، سجل دخول تاني',
  RATE_LIMITED: 'محاولات كتير جداً، استنى شوية',
} as const

export type AuthErrorCode = keyof typeof AUTH_ERRORS

export function getAuthErrorMessage(code: string, fallback = 'حصل خطأ، جرّب تاني'): string {
  return AUTH_ERRORS[code] ?? fallback
}

export type AuthErrorCategory = 'user_error' | 'system_error' | 'rate_limit'

export function categorizeAuthError(code: string): {
  message: string
  category: AuthErrorCategory
  showToast: boolean
  redirect?: string
} {
  const message = getAuthErrorMessage(code)
  // user errors — تظهر كـ inline أو toast بسيط
  const userCodes: Record<string, true> = {
    USERNAME_TAKEN: true,
    EMAIL_TAKEN: true,
    WEAK_PASSWORD: true,
    INVALID_EMAIL: true,
    EMAIL_NOT_VERIFIED: true,
    WRONG_PASSWORD: true,
    USER_BANNED: true,
    TELEGRAM_FAILED: true,
    GOOGLE_FAILED: true,
    SESSION_EXPIRED: true,
  }
  if (code === 'RATE_LIMITED') {
    return { message, category: 'rate_limit', showToast: true }
  }
  if (userCodes[code]) {
    const redirect =
      code === 'EMAIL_NOT_VERIFIED'
        ? '/verify-email'
        : code === 'SESSION_EXPIRED'
          ? '/login'
          : undefined
    return { message, category: 'user_error', showToast: true, redirect }
  }
  // أي كود غير معروف يعتبر system_error
  return { message, category: 'system_error', showToast: true }
}
