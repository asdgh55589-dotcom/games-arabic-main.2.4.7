import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { setRoleCookie, getBanStatus, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import {
  createTelegramSession,
  getTelegramSession,
  deleteTelegramSession,
} from '@/lib/telegram-sessions'
import { ok, validationFail, internalError } from '@/lib/api-response'
import { generateUniqueUsername } from '@/lib/username-generator'

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const botName =
      process.env.TELEGRAM_BOT_NAME ||
      process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ||
      'GAMES_ARABIC_BOT'
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN not configured')
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

    const loginResult = await performLogin(session.userData)

    await deleteTelegramSession(sessionToken)

    if (loginResult.error) {
      return ok({ status: loginResult.status, error: loginResult.error })
    }

    return ok({
      status: 'success',
      user: loginResult.user,
    })
  } catch (err) {
    console.error(
      '[auth/telegram GET] failed:',
      err instanceof Error ? err.message : 'unknown error',
    )
    return internalError('حدث خطأ')
  }
}

// دالة مساعدة لتسجيل الدخول ووضع الكوكيز
async function performLogin(userData: {
  telegramId: number
  firstName: string
  lastName?: string | null
  username?: string | null
  photoUrl?: string | null
}) {
  try {
    const { telegramId, firstName, lastName, username, photoUrl } = userData

    const displayName =
      [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram User ${telegramId}`
    const email = `telegram_${telegramId}@telegram.local`
    const avatarUrl = photoUrl || null

    // البحث عن مستخدم موجود عبر OAuthAccount
    type NeonUser = {
      id: string
      username: string
      email: string
      role: string
      avatarUrl: string | null
      banStatus: string
      bannedUntil: Date | null
      banReason: string | null
      tokenVersion: number
    }
    let neonUser: NeonUser | null = null
    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'telegram',
          providerAccountId: telegramId.toString(),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            tokenVersion: true,
          },
        },
      },
    })

    if (existingOAuth) {
      neonUser = existingOAuth.user
      if (!neonUser.avatarUrl && avatarUrl) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: { avatarUrl },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            tokenVersion: true,
          },
        })
      }
    } else {
      // فحص البريد الإلكتروني
      const emailUser = await db.user.findUnique({
        where: { email },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarUrl: true,
          banStatus: true,
          bannedUntil: true,
          banReason: true,
          tokenVersion: true,
        },
      })

      if (emailUser) {
        neonUser = emailUser
        await db.oAuthAccount
          .create({
            data: {
              userId: emailUser.id,
              provider: 'telegram',
              providerAccountId: telegramId.toString(),
              providerEmail: email,
              providerUsername: username || null,
              avatarUrl,
            },
          })
          .catch(() => {})
      } else {
        const baseUsername = username || displayName.toLowerCase().replace(/\s+/g, '_')
        const finalUsername = await generateUniqueUsername(baseUsername)

        neonUser = await db.user.upsert({
          where: { email },
          create: {
            username: finalUsername,
            email,
            avatarUrl,
            role: 'member',
            emailVerified: true,
          },
          update: {},
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            avatarUrl: true,
            banStatus: true,
            bannedUntil: true,
            banReason: true,
            tokenVersion: true,
          },
        })

        await db.oAuthAccount
          .create({
            data: {
              userId: neonUser.id,
              provider: 'telegram',
              providerAccountId: telegramId.toString(),
              providerEmail: email,
              providerUsername: username || null,
              avatarUrl,
            },
          })
          .catch(() => {})
      }
    }

    // فحص الحظر
    const ban = getBanStatus(neonUser)
    if (ban.banned) {
      return { status: 'banned', error: 'حسابك محظور' }
    }

    // إنشاء role cookie
    await setRoleCookie(neonUser.id, neonUser.role as UserRole, neonUser.tokenVersion)

    // تحديث lastLoginAt
    await db.user.update({
      where: { id: neonUser.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    // تسجيل audit
    await logAction({
      userId: neonUser.id,
      username: neonUser.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser.id,
    })

    return {
      user: {
        id: neonUser.id,
        username: neonUser.username,
        email: neonUser.email,
        role: neonUser.role,
        avatarUrl: neonUser.avatarUrl,
      },
    }
  } catch (err) {
    console.error('[performLogin] failed:', err)
    return { status: 'error', error: 'حدث خطأ أثناء تسجيل الدخول' }
  }
}
