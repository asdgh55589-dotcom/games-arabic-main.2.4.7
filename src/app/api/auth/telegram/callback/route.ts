import type { NextRequest } from 'next/server'
import { internalError, ok, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { getBanStatus, setRoleCookie, type UserRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { isAuthDateValid, verifyTelegramAuth } from '@/lib/telegram-verify'
import { generateUniqueUsername } from '@/lib/username-generator'

export async function POST(req: NextRequest) {
  try {
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

    const userData = {
      telegramId: Number(id),
      firstName: String(first_name),
      lastName: last_name ? String(last_name) : null,
      username: username ? String(username) : null,
      photoUrl: photo_url ? String(photo_url) : null,
    }

    const loginResult = await performLogin(userData)

    if (loginResult.error) {
      return validationFail({ message: loginResult.error })
    }

    return ok({ user: loginResult.user })
  } catch (err) {
    console.error('[Telegram callback] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ أثناء تسجيل الدخول')
  }
}

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

    const userSelect = {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      banStatus: true,
      bannedUntil: true,
      banReason: true,
      tokenVersion: true,
    } as const

    let neonUser: {
      id: string
      username: string
      email: string
      role: string
      avatarUrl: string | null
      banStatus: string
      bannedUntil: Date | null
      banReason: string | null
      tokenVersion: number
    } | null = null

    const existingOAuth = await db.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'telegram',
          providerAccountId: telegramId.toString(),
        },
      },
      include: { user: { select: userSelect } },
    })

    if (existingOAuth) {
      neonUser = existingOAuth.user
      if (!neonUser.avatarUrl && avatarUrl) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: { avatarUrl },
          select: userSelect,
        })
      } else if (avatarUrl && neonUser.avatarUrl !== avatarUrl) {
        // تحديث الصورة إذا كانت مختلفة
        try {
          neonUser = await db.user.update({
            where: { id: neonUser.id },
            data: { avatarUrl },
            select: userSelect,
          })
        } catch {}
      }
    } else {
      const emailUser = await db.user.findUnique({
        where: { email },
        select: userSelect,
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
            displayName,
            email,
            avatarUrl,
            role: 'member',
            emailVerified: true,
          },
          update: {},
          select: userSelect,
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

    const ban = getBanStatus(neonUser!)
    if (ban.banned) {
      return { status: 'banned', error: 'حسابك محظور' }
    }

    await setRoleCookie(neonUser!.id, neonUser!.role as UserRole, neonUser!.tokenVersion)

    await db.user.update({
      where: { id: neonUser!.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    })

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
      },
    }
  } catch (err) {
    console.error('[performLogin callback] failed:', err)
    return { status: 'error', error: 'حدث خطأ أثناء تسجيل الدخول' }
  }
}
