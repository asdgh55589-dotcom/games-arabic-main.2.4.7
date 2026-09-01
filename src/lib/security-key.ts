import { randomBytes } from 'crypto'
import { hashPassword } from '@/lib/auth'
import bcrypt from 'bcryptjs'

/**
 * توليد مفتاح أمان عشوائي أبجدي-رقمي
 * مثال: "aB3kZ9mQ2xL7pN4w" (16 حرف)
 */
export function generateSecurityKey(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  const bytes = randomBytes(length)
  for (let i = 0; i < length; i++) {
    key += chars[bytes[i] % chars.length]
  }
  return key
}

/**
 * تشفير مفتاح الأمان قبل التخزين (نفس تشفير كلمة المرور)
 */
export async function hashSecurityKey(key: string): Promise<string> {
  return hashPassword(key)
}

/**
 * التحقق من مفتاح الأمان مقابل النص المشفر
 */
export async function verifySecurityKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash)
}

/**
 * التحقق من صيغة مفتاح الأمان
 * يجب أن يكون أبجدي-رقمي، 8 أحرف على الأقل
 */
export function validateSecurityKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.length < 8) {
    return { valid: false, error: 'مفتاح الأمان يجب أن يكون 8 خانات على الأقل' }
  }
  if (!/^[a-zA-Z0-9]+$/.test(key)) {
    return { valid: false, error: 'مفتاح الأمان يجب أن يحتوي على أرقام وحروف إنجليزية فقط' }
  }
  return { valid: true }
}

/**
 * فحص انتهاء صلاحية مفتاح الأمان
 */
export function isSecurityKeyExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false // بدون انتهاء = لا ينتهي
  return new Date() > new Date(expiresAt)
}
