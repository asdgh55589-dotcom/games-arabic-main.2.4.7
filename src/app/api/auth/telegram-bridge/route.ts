import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTelegramAuth, isAuthDateValid } from '@/lib/telegram-verify'
import { rateLimit } from '@/lib/rate-limit'
import { getBanStatus } from '@/lib/auth'
import { AUTH_ERRORS } from '@/lib/auth/errors'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10/min
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'telegram-bridge' })
    if (!rl.success) {
      return NextResponse.json(
        { error: AUTH_ERRORS.RATE_LIMITED, code: 'RATE_LIMITED' },
        { status: 429 },
      )
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

    const telegramId = Number(data.id)
    const firstName = data.first_name || ''
    const lastName = data.last_name || ''
    const usernameRaw = data.username || ''
    const photoUrl = data.photo_url || null

    const displayName =
      [firstName, lastName].filter(Boolean).join(' ') || usernameRaw || `Telegram_${telegramId}`
    const email = `telegram_${telegramId}@telegram.local`
    // username must be unique — try telegram username, fallback to tg_ + id
    let username = usernameRaw
      ? usernameRaw.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)
      : `tg_${telegramId}`
    // Ensure username unique
    const existingByUsername = await db.user.findUnique({ where: { username } })
    if (existingByUsername) {
      // if exists but same telegram user (via OAuthAccount), we will find later; otherwise suffix
      const viaOA = await db.oAuthAccount.findFirst({
        where: { provider: 'telegram', providerAccountId: String(telegramId) },
      })
      if (!viaOA || viaOA.userId !== existingByUsername.id) {
        username = `tg_${telegramId}_${Math.random().toString(36).slice(2, 6)}`
      }
    }

    // 1) Find by OAuthAccount
    let user = null as any
    const oauth = await db.oAuthAccount.findFirst({
      where: { provider: 'telegram', providerAccountId: String(telegramId) },
      include: { user: true },
    })
    if (oauth?.user) {
      user = oauth.user
    } else {
      // 2) Try by email placeholder
      user = await db.user.findUnique({ where: { email } })
      if (!user) {
        // Check username collision again before create
        const taken = await db.user.findUnique({ where: { username } })
        if (taken) username = `tg_${telegramId}_${Date.now().toString(36).slice(-4)}`

        // Auto-create
        user = await db.user.create({
          data: {
            username,
            displayName,
            email,
            avatarUrl: photoUrl,
            emailVerified: true, // telegram = verified
            role: 'member',
          },
        })
      }
      // Ensure OAuthAccount link exists
      const existingLink = await db.oAuthAccount.findFirst({
        where: { provider: 'telegram', providerAccountId: String(telegramId) },
      })
      if (!existingLink) {
        await db.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'telegram',
            providerAccountId: String(telegramId),
            providerUsername: usernameRaw || null,
            avatarUrl: photoUrl,
          },
        })
      } else if (existingLink.userId !== user.id) {
        // orphan — update
        await db.oAuthAccount.update({ where: { id: existingLink.id }, data: { userId: user.id } })
      }
      // keep emailVerified true for telegram
      if (!user.emailVerified) {
        await db.user.update({ where: { id: user.id }, data: { emailVerified: true } })
        user.emailVerified = true
      }
    }

    // Ban check
    const ban = getBanStatus(user)
    if (ban.banned) {
      return NextResponse.json(
        { error: AUTH_ERRORS.USER_BANNED, code: 'USER_BANNED' },
        { status: 403 },
      )
    }

    // Create Better Auth session via DB (Session model)
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
    const now = new Date()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const sessionId = randomUUID()

    // Better Auth expects session fields: id, token, expiresAt, createdAt, updatedAt, ipAddress, userAgent, userId
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null
    const ua = req.headers.get('user-agent') || null

    await db.session.create({
      data: {
        id: sessionId,
        token,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        ipAddress: ip,
        userAgent: ua,
        userId: user.id,
      } as any,
    })

    const res = NextResponse.json({
      success: true,
      redirectTo: '/',
      user: { id: user.id, username: user.username },
    })
    // Also set legacy ga_admin_role JWT for compatibility with proxy.ts / getSession fallback
    try {
      const fresh = await db.user.findUnique({
        where: { id: user.id },
        select: { tokenVersion: true, role: true },
      })
      const { SignJWT } = await import('jose')
      const { getJWTSecret } = await import('@/lib/auth')
      const secret = getJWTSecret()
      const payload: Record<string, unknown> = { userId: user.id, role: fresh?.role || 'member' }
      if (fresh?.tokenVersion !== undefined) payload.tv = fresh.tokenVersion
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret)
      res.cookies.set('ga_admin_role', jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        domain: process.env.COOKIE_DOMAIN || undefined,
      })
    } catch (e) {
      console.warn('[telegram-bridge] failed to set legacy cookie', e)
    }
    // سجل الجلسة المركزي
    res.cookies.set('ga_session_ledger', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
    // Also set broader domain if COOKIE_DOMAIN set
    return res
  } catch (err) {
    console.error('[telegram-bridge] failed:', err)
    return NextResponse.json(
      { error: AUTH_ERRORS.TELEGRAM_FAILED, code: 'TELEGRAM_FAILED' },
      { status: 500 },
    )
  }
}
