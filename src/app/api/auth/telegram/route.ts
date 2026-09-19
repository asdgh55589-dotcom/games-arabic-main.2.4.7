import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { reportError } from '@/lib/error-reporting'
import { performTelegramLogin } from '@/lib/telegram-login'
import {
  createTelegramSession,
  deleteTelegramSession,
  getTelegramSession,
} from '@/lib/telegram-sessions'

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    // Bot username must match the token's bot. NEXT_PUBLIC_* is readable
    // server-side; TELEGRAM_BOT_NAME is kept as a secondary source so existing
    // deployments that set the server-only var keep working. There is NO
    // hardcoded fallback — a wrong bot would swallow /start updates silently.
    const botName =
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_NAME
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
      return internalError('خدمة Telegram غير مهيأة حالياً')
    }
    if (!botName) {
      console.error('[Telegram] bot username not configured (NEXT_PUBLIC_TELEGRAM_BOT_USERNAME)')
      return internalError('خدمة Telegram غير مهيأة حالياً')
    }

    const sessionToken = crypto.randomUUID()

    await createTelegramSession(sessionToken)

    const deepLink = `https://t.me/${botName}?start=${sessionToken}`

    return ok({ sessionToken, deepLink })
  } catch (err) {
    console.error(
      '[auth/telegram POST] failed:',
      err instanceof Error ? err.message : 'unknown error',
    )
    return internalError('حدث خطأ')
  }
}

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
      return internalError('خدمة Telegram غير مهيأة حالياً')
    }

    const { searchParams } = new URL(req.url)
    const sessionToken = searchParams.get('token')

    if (!sessionToken) {
      return validationFail({ token: 'token required' })
    }

    const session = await getTelegramSession(sessionToken)

    if (!session) {
      return ok({ status: 'pending' })
    }

    if (Date.now() > session.expiresAt) {
      return ok({ status: 'expired' })
    }

    if (!session.used) {
      return ok({ status: 'pending' })
    }

    if (!session.userData) {
      return ok({ status: 'pending' })
    }

    const loginResult = await performTelegramLogin(session.userData, {
      ipAddress:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })

    await deleteTelegramSession(sessionToken)

    if (!loginResult.ok) {
      return ok({ status: loginResult.status, error: loginResult.error })
    }

    const res = ok({
      status: 'success',
      user: loginResult.user,
    })
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
    reportError(err, { route: 'GET /api/auth/telegram' })
    return internalError('حدث خطأ')
  }
}
