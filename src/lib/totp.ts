import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'

// إعداد TOTP — نافذة 1 خطوة قبل/بعد (30 ثانية)
authenticator.options = {
  window: 1,
  step: 30,
}

/**
 * توليد سر TOTP جديد (base32)
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret()
}

/**
 * توليد رابط TOTP لـ QR code
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = 'GamesArabic'): string {
  return authenticator.keyuri(email, issuer, secret)
}

/**
 * توليد QR code كـ Data URL
 */
export async function generateQRCode(uri: string): Promise<string> {
  return QRCode.toDataURL(uri)
}

/**
 * التحقق من رمز TOTP
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}

/**
 * تشفير سر TOTP قبل الحفظ في DB (base64 — في الإنتاج يُفضل تشفير أقوى)
 */
export function encryptTOTPSecret(secret: string): string {
  return Buffer.from(secret).toString('base64')
}

/**
 * فك تشفير سر TOTP من DB
 */
export function decryptTOTPSecret(encryptedSecret: string): string {
  return Buffer.from(encryptedSecret, 'base64').toString('utf-8')
}
