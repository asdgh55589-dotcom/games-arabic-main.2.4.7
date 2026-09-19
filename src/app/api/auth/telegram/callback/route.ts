import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { reportError } from '@/lib/error-reporting'
import { rateLimit } from '@/lib/rate-limit'
import { performTelegramLogin } from '@/lib/telegram-login'
import { isAuthDateValid, verifyTelegramAuth } from '@/lib/telegram-verify'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 widget-logins/min per IP.
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'telegram:callback' })
    if (!rl.success) {
      return rateLimited('تم تجاوز الحد المسموح. حاول مرة أخرى لاحقاً.', 60)
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      console.error('[Telegram callback] TELEGRAM_BOT_TOKEN not configured')
      return internalError('خدمة Telegram غير مهيأة حالياً')
    }

    const body = await req.json()

    // body يحتوي على بيانات Telegram Login Widget
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = body

    if (!id || !hash || !auth_date) {
      return validationFail({ message: 'بيانات Telegram غير مكتملة' })
    }

    // التحقق من صحة auth_date (خلال 24 ساعة)
    if (!isAuthDateValid(auth_date)) {
      return validationFail({ message: 'انتهت صلاحية بيانات Telegram' })
    }

    // التحقق من الهاش
    const dataForVerify: Record<string, string> = {}
    if (id) dataForVerify.id = String(id)
    if (first_name) dataForVerify.first_name = String(first_name)
    if (last_name) dataForVerify.last_name = String(last_name)
    if (username) dataForVerify.username = String(username)
    if (photo_url) dataForVerify.photo_url = String(photo_url)
    dataForVerify.auth_date = String(auth_date)
    dataForVerify.hash = String(hash)

    if (!verifyTelegramAuth(dataForVerify)) {
      console.warn('[Telegram callback] Invalid hash', { id })
      return validationFail({ message: 'بيانات Telegram غير صحيحة' })
    }

    const loginResult = await performTelegramLogin(
      {
        telegramId: Number(id),
        firstName: String(first_name),
        lastName: last_name ? String(last_name) : null,
        username: username ? String(username) : null,
        photoUrl: photo_url ? String(photo_url) : null,
      },
      {
        ipAddress:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      },
    )

    if (!loginResult.ok) {
      return validationFail({ message: loginResult.error })
    }

    const res = ok({ user: loginResult.user })
    if (loginResult.ledgerToken && loginResult.ledgerExpires) {
      res.cookies.set('ga_session_ledger', loginResult.ledgerToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: loginResult.ledgerExpires,
      })
    }
    return res
  } catch (err) {
    reportError(err, { route: 'GET /api/auth/telegram/callback' })
    return internalError('حدث خطأ أثناء تسجيل الدخول')
  }
}
