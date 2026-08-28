import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { setRoleCookie, getBanStatus, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { getTelegramSession, updateTelegramSession } from '@/lib/telegram-sessions'
import { ok, validationFail } from '@/lib/api-response'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionToken = searchParams.get('token')

    if (!sessionToken) {
      return validationFail({ token: 'token required' })
    }

    const session = await getTelegramSession(sessionToken)

    if (!session) {
      return ok({ status: 'pending' })
    }

    if (session.used && session.user) {
      return ok({ status: 'success', user: session.user })
    }

    if (Date.now() > session.expiresAt) {
      return ok({ status: 'expired' })
    }

    const updatesRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-10`)
    const updatesData = await updatesRes.json()

    if (!updatesData.ok) {
      return ok({ status: 'pending' })
    }

    for (const update of updatesData.result) {
      const message = update.message
      if (!message || !message.text) continue

      const text = message.text
      if (text.startsWith('/start ') && text.includes(sessionToken)) {
        const userData = {
          telegramId: message.from.id,
          firstName: message.from.first_name,
          lastName: message.from.last_name || null,
          username: message.from.username || null,
          photoUrl: null,
        }

        const loginResult = await performLogin(userData)
        if (loginResult.error) {
          return ok({ status: loginResult.status, error: loginResult.error })
        }

        await updateTelegramSession(sessionToken, {
          ...session,
          used: true,
          userData,
          user: loginResult.user,
        })

        const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(' ')
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: `✅ تم تسجيل الدخول بنجاح!\n\nمرحباً ${displayName}، يمكنك الآن العودة إلى الموقع.`,
            parse_mode: 'HTML',
          }),
        })

        return ok({ status: 'success', user: loginResult.user })
      }
    }

    return ok({ status: 'pending' })
  } catch (err) {
    console.error('[telegram poll] failed:', err instanceof Error ? err.message : 'unknown error')
    return ok({ status: 'pending' })
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

    const displayName = [firstName, lastName].filter(Boolean).join(' ') || username || `Telegram User ${telegramId}`
    const email = `telegram_${telegramId}@telegram.local`
    const avatarUrl = photoUrl || null

    const userSelect = {
      id: true, username: true, email: true, role: true, avatarUrl: true,
      banStatus: true, bannedUntil: true, banReason: true, tokenVersion: true,
    } as const

    // Step 1: Find by OAuthAccount (telegram, telegramId)
    let neonUser: {
      id: string; username: string; email: string; role: string; avatarUrl: string | null;
      banStatus: string; bannedUntil: Date | null; banReason: string | null; tokenVersion: number;
    } | null = null
    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'telegram',
          providerAccountId: telegramId.toString(),
        },
      },
      include: {
        user: {
          select: userSelect,
        },
      },
    })

    if (existingOAuth) {
      neonUser = existingOAuth.user
      if (!neonUser.avatarUrl && avatarUrl) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: { avatarUrl },
          select: userSelect,
        })
      }
    } else {
      // Step 2: Try to find by email (telegram_{id}@telegram.local)
      const emailUser = await db.user.findUnique({
        where: { email },
        select: userSelect,
      })

      if (emailUser) {
        neonUser = emailUser
        await db.oAuthAccount.create({
          data: {
            userId: emailUser.id,
            provider: 'telegram',
            providerAccountId: telegramId.toString(),
            providerEmail: email,
            providerUsername: username || null,
            avatarUrl,
          },
        }).catch(() => {})
      } else {
        // Step 3: Create new user + OAuthAccount (handle concurrent creation with upsert)
        let finalUsername = username || displayName.toLowerCase().replace(/\s+/g, '_')
        let counter = 1
        while (true) {
          const existing = await db.user.findUnique({
            where: { username: finalUsername },
            select: { id: true },
          })
          if (!existing) break
          finalUsername = `${username || 'telegram_user'}${counter}`
          counter++
        }

        const user = await db.user.upsert({
          where: { email },
          create: {
            username: finalUsername,
            email,
            avatarUrl,
            role: 'member',
            emailVerified: true,
          },
          update: {},
          select: userSelect,
        })

        neonUser = user

        await db.oAuthAccount.create({
          data: {
            userId: user.id,
            provider: 'telegram',
            providerAccountId: telegramId.toString(),
            providerEmail: email,
            providerUsername: username || null,
            avatarUrl,
          },
        }).catch(() => {})
      }
    }

    // فحص الحظر
    const ban = getBanStatus(neonUser!)
    if (ban.banned) {
      return { status: 'banned', error: 'حسابك محظور' }
    }

    // إنشاء role cookie — مرة واحدة فقط
    await setRoleCookie(neonUser!.id, neonUser!.role as UserRole, neonUser!.tokenVersion)

    // تحديث lastLoginAt
    await db.user.update({
      where: { id: neonUser!.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

    // تسجيل audit
    await logAction({
      userId: neonUser!.id,
      username: neonUser!.username,
      action: 'login',
      entity: 'user',
      entityId: neonUser!.id,
    })

    return {
      user: {
        id: neonUser!.id,
        username: neonUser!.username,
        email: neonUser!.email,
        role: neonUser!.role,
        avatarUrl: neonUser!.avatarUrl,
      }
    }
  } catch (err) {
    console.error('[performLogin] failed:', err)
    return { status: 'error', error: 'حدث خطأ أثناء تسجيل الدخول' }
  }
}
