import { type NextRequest, NextResponse } from 'next/server'
import { rateLimited } from '@/lib/api-response'
import { AUTH_ERRORS } from '@/lib/auth/errors'
import { logger } from '@/lib/logger'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { performTelegramLogin } from '@/lib/telegram-login'
import { isAuthDateValid, verifyTelegramAuth } from '@/lib/telegram-verify'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10/min (canonical rate-limit.ts — Redis + memory fallback)
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'telegram-bridge' })
    if (!rl.success) {
      const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))
      const res = rateLimited(AUTH_ERRORS.RATE_LIMITED, retryAfter, req.nextUrl.pathname)
      const headers = rateLimitHeaders(rl)
      for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
      return res
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body.id === 'undefined') {
      return NextResponse.json(
        { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
        { status: 400 },
      )
    }

    // Telegram payload format from widget: id, first_name, last_name, username, photo_url, auth_date, hash
    const data: Record<string, string> = {}
    for (const k of [
      'id',
      'first_name',
      'last_name',
      'username',
      'photo_url',
      'auth_date',
      'hash',
    ]) {
      if (body[k] !== undefined && body[k] !== null) data[k] = String(body[k])
    }

    // Verify HMAC
    if (!verifyTelegramAuth(data)) {
      logger.warn({ route: 'telegram-bridge' }, 'telegram signature invalid')
      return NextResponse.json(
        { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
        { status: 401 },
      )
    }
    if (!isAuthDateValid(data.auth_date, 86400)) {
      return NextResponse.json(
        { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
        { status: 401 },
      )
    }

    // Canonical login (shared with telegram/route, telegram/callback, telegram/poll)
    const loginResult = await performTelegramLogin(
      {
        telegramId: Number(data.id),
        firstName: data.first_name || '',
        lastName: data.last_name || null,
        username: data.username || null,
        photoUrl: data.photo_url || null,
      },
      { ipAddress: bridgeIp, userAgent: req.headers.get('user-agent') },
    )

    if (!loginResult.ok) {
      if (loginResult.status === 'banned') {
        return NextResponse.json(
          { error: AUTH_ERRORS.USER_BANNED, code: 'USER_BANNED' },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
        { status: 500 },
      )
    }

    const { user } = loginResult
    // NOTE: ga_admin_role was already attached to this response by the
    // canonical login via setRoleCookie (next/headers cookies propagate to
    // Route Handler responses). Only the ledger cookie needs explicit setting.
    const res = NextResponse.json({
      success: true,
      redirectTo: '/',
      user: { id: user.id, username: user.username },
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
    logger.error({ route: 'telegram-bridge', err }, 'telegram bridge failed')
    const { reportError } = await import('@/lib/error-reporting').catch(() => ({
      reportError: () => 'skipped' as const,
    }))
    reportError(err, { route: 'POST /api/auth/telegram-bridge' })
    return NextResponse.json(
      { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
      { status: 500 },
    )
  }
}
