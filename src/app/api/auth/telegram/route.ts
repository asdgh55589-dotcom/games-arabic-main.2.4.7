import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { setRoleCookie, getBanStatus, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { createTelegramSession, getTelegramSession, deleteTelegramSession } from '@/lib/telegram-sessions'

// POST /api/auth/telegram — إنشاء session token
export async function POST(req: NextRequest) {
  try {
    const sessionToken = crypto.randomUUID()

    // حفظ الـ session في Redis
    await createTelegramSession(sessionToken)

    const botName = process.env.TELEGRAM_BOT_NAME || 'GAMES_ARABIC_BOT'
    const deepLink = `https://t.me/${botName}?start=${sessionToken}`

    return NextResponse.json({ sessionToken, deepLink })
  } catch (err) {
    console.error('[auth/telegram POST] failed:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// GET /api/auth/telegram?token=... — التحقق من حالة المصادقة
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionToken = searchParams.get('token')

    if (!sessionToken) {
      return NextResponse.json({ error: 'token required' }, { status: 400 })
    }

    // قراءة الـ session من Redis
    const session = await getTelegramSession(sessionToken)

    if (!session) {
      return NextResponse.json({ status: 'pending' })
    }

    // فحص انتهاء الصلاحية
    if (Date.now() > session.expiresAt) {
      return NextResponse.json({ status: 'expired' })
    }

    // فحص إذا لم يُستخدم بعد
    if (!session.used) {
      return NextResponse.json({ status: 'pending' })
    }

    // المستخدم أكمل المصادقة — تسجيل الدخول
    if (!session.userData) {
      return NextResponse.json({ status: 'pending' })
    }

    const loginResult = await performLogin(session.userData)

    // حذف الـ session
    await deleteTelegramSession(sessionToken)

    if (loginResult.error) {
      return NextResponse.json({ status: loginResult.status, error: loginResult.error })
    }

    return NextResponse.json({
      status: 'success',
      user: loginResult.user,
    })
  } catch (err) {
    console.error('[auth/telegram GET] failed:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
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

    // البحث عن مستخدم موجود
    let neonUser = await db.user.findFirst({
      where: {
        OR: [
          { providerAccountId: telegramId.toString() },
          { email },
        ],
      },
      select: {
        id: true, username: true, email: true, role: true, avatarUrl: true,
        banStatus: true, bannedUntil: true, banReason: true, tokenVersion: true,
      },
    })

    if (neonUser) {
      if (!neonUser.avatarUrl && avatarUrl) {
        neonUser = await db.user.update({
          where: { id: neonUser.id },
          data: { avatarUrl },
          select: {
            id: true, username: true, email: true, role: true, avatarUrl: true,
            banStatus: true, bannedUntil: true, banReason: true, tokenVersion: true,
          },
        })
      }
    } else {
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

      neonUser = await db.user.create({
        data: {
          username: finalUsername,
          email,
          avatarUrl,
          role: 'member',
          provider: 'telegram',
          providerAccountId: telegramId.toString(),
          emailVerified: true,
        },
        select: {
          id: true, username: true, email: true, role: true, avatarUrl: true,
          banStatus: true, bannedUntil: true, banReason: true, tokenVersion: true,
        },
      })
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
      }
    }
  } catch (err) {
    console.error('[performLogin] failed:', err)
    return { status: 'error', error: 'حدث خطأ أثناء تسجيل الدخول' }
  }
}
