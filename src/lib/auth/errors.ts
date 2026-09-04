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
