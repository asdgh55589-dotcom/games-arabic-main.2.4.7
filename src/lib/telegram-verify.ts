import { createHmac, createHash } from 'crypto'

/**
 * التحقق من بيانات Telegram Login Widget
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * الصيغة: hash = HMAC-SHA256(data_check_string, SHA256(bot_token))
 * حيث data_check_string = key=value مرتبة أبجدياً ومفصولة بـ \n
 */
export function verifyTelegramAuth(data: Record<string, string>): boolean {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return false

  const receivedHash = data.hash
  if (!receivedHash) return false

  // إنشاء data-check-string
  const checkString = Object.keys(data)
    .filter((key) => key !== 'hash')
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n')

  // المفتاح السري = SHA256(bot_token)
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest()

  // حساب الهاش
  const calculatedHash = createHmac('sha256', secretKey).update(checkString).digest('hex')

  return calculatedHash === receivedHash
}

/**
 * التحقق من صلاحية auth_date (يجب أن يكون خلال 24 ساعة)
 */
export function isAuthDateValid(authDate: string | number, maxAgeSeconds: number = 86400): boolean {
  const timestamp = typeof authDate === 'string' ? parseInt(authDate, 10) : authDate
  if (isNaN(timestamp)) return false
  const now = Math.floor(Date.now() / 1000)
  return now - timestamp <= maxAgeSeconds
}
