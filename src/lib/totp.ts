import { createDecipheriv, createCipheriv, createHash, randomBytes } from 'node:crypto'
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
export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = 'GamesArabic',
): string {
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
 * Audit D.2: TOTP secrets at rest use real AES-256-GCM (the old base64
 * "encryption" was obfuscation). Key = SHA-256('mfa-totp-v1:' + JWT_SECRET),
 * random 12-byte IV per row, format `gcm1.<iv-hex>.<ct-hex>.<tag-hex>`.
 * Legacy base64 rows (no `gcm1.` prefix) still decrypt — migration compat,
 * re-encrypted on next setup. Missing JWT_SECRET throws (fail-closed).
 */
const GCM_PREFIX = 'gcm1.'

function getTotpKey(): Buffer {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required (totp-at-rest)')
  }
  return createHash('sha256').update(`mfa-totp-v1:${secret}`).digest()
}

/**
 * تشفير سر TOTP قبل الحفظ في DB (AES-256-GCM)
 */
export function encryptTOTPSecret(secret: string): string {
  const key = getTotpKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${GCM_PREFIX}${iv.toString('hex')}.${ct.toString('hex')}.${tag.toString('hex')}`
}

/**
 * فك تشفير سر TOTP من DB (يدعم صفوف base64 القديمة)
 */
export function decryptTOTPSecret(encryptedSecret: string): string {
  if (!encryptedSecret.startsWith(GCM_PREFIX)) {
    return Buffer.from(encryptedSecret, 'base64').toString('utf-8')
  }
  const key = getTotpKey()
  const [, ivHex, ctHex, tagHex] = encryptedSecret.split('.')
  if (!ivHex || !ctHex || !tagHex) throw new Error('malformed TOTP envelope')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString('utf-8')
}
