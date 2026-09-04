import { randomBytes } from 'crypto'

/**
 * توليد 10 رموز استرداد (8 أحرف هكس كبيرة)
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < 10; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    codes.push(code)
  }
  return codes
}

/**
 * تشفير رموز الاسترداد قبل الحفظ (base64)
 */
export function encryptRecoveryCodes(codes: string[]): string {
  return Buffer.from(JSON.stringify(codes)).toString('base64')
}

/**
 * فك تشفير رموز الاسترداد
 */
export function decryptRecoveryCodes(encryptedCodes: string): string[] {
  return JSON.parse(Buffer.from(encryptedCodes, 'base64').toString('utf-8'))
}

/**
 * التحقق من رمز الاسترداد
 */
export function verifyRecoveryCode(
  code: string,
  encryptedCodes: string,
  usedIndices: number[] = [],
): { valid: boolean; index: number } {
  try {
    const codes = decryptRecoveryCodes(encryptedCodes)
    const normalizedCode = code.toUpperCase().trim()
    for (let i = 0; i < codes.length; i++) {
      if (codes[i] === normalizedCode && !usedIndices.includes(i)) {
        return { valid: true, index: i }
      }
    }
    return { valid: false, index: -1 }
  } catch {
    return { valid: false, index: -1 }
  }
}

/**
 * تمييز رمز كـ مستعمل
 */
export function markRecoveryCodeUsed(usedIndices: number[], index: number): number[] {
  return [...usedIndices, index]
}
