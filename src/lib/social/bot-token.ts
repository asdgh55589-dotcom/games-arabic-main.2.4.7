/**
 * lib/social/bot-token.ts — تشفير توكنات بوتات تليجرام عند الراحة (at rest).
 *
 * القرار D7 (Social Hub): توكن البوت لكل سجل `SocialTelegramBot` يُخزَّن
 * مشفّراً AES-256-GCM بنفس نمط audit D.2 في `lib/totp.ts`:
 *
 *   key    = SHA-256('social-telegram-bot-v1:' + JWT_SECRET)
 *   format = `gcm1.<iv-hex>.<ct-hex>.<tag-hex>`   (IV عشوائي 12 بايت لكل صف)
 *
 * غياب JWT_SECRET يرمي استثناءً (fail-closed) — لا تشفير ضعيف احتياطي.
 * التوكن لا يظهر إطلاقاً في أي استجابة API: الدوال هنا للاستخدام الخادمي فقط.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const GCM_PREFIX = 'gcm1.'

function getBotTokenKey(): Buffer {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required (social-bot-token)')
  }
  return createHash('sha256').update(`social-telegram-bot-v1:${secret}`).digest()
}

/** تشفير توكن بوت قبل حفظه في `social_telegram_bots.token_enc`. */
export function encryptBotToken(token: string): string {
  const key = getBotTokenKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${GCM_PREFIX}${iv.toString('hex')}.${ct.toString('hex')}.${tag.toString('hex')}`
}

/** فك تشفير توكن بوت من `social_telegram_bots.token_enc`. يرمي عند التلف. */
export function decryptBotToken(encrypted: string): string {
  if (!encrypted.startsWith(GCM_PREFIX)) {
    throw new Error('malformed social bot token envelope')
  }
  const key = getBotTokenKey()
  const parts = encrypted.split('.')
  const [, ivHex, ctHex, tagHex] = parts
  if (!ivHex || !ctHex || !tagHex) throw new Error('malformed social bot token envelope')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]).toString(
    'utf-8',
  )
}

/** حشو توكن للاختبارات/السجلات: `123456:AA…AbCd` → `123456:…AbCd`. */
export function maskBotToken(token: string): string {
  if (!token) return ''
  const colon = token.indexOf(':')
  const idPart = colon > 0 ? token.slice(0, colon + 1) : ''
  const tail = token.length > 4 ? token.slice(-4) : token
  return `${idPart}…${tail}`
}
