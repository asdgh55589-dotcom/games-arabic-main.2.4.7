import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setRoleCookie, getBanStatus, type UserRole } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { getTelegramSession, updateTelegramSession } from '@/lib/telegram-sessions'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

// GET /api/auth/telegram/poll?token=... — جلب التحديثات من Telegram ومعالجة Deep Link
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

    // فحص إذا تم المصادقة بالفعل — نُرجع بيانات المستخدم المحفوظة
    if (session.used && session.user) {
      return NextResponse.json({ status: 'success', user: session.user })
    }

    // فحص انتهاء الصلاحية
    if (Date.now() > session.expiresAt) {
      return NextResponse.json({ status: 'expired' })
    }

    // جلب التحديثات من Telegram
    const updatesRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=-10`)
    const updatesData = await updatesRes.json()

    if (!updatesData.ok) {
      return NextResponse.json({ status: 'pending' })
    }

    // البحث عن update يحتوي على Deep Link بهذا الـ session token
    for (const update of updatesData.result) {
      const message = update.message
      if (!message || !message.text) continue

      const text = message.text
      if (text.startsWith('/start ') && text.includes(sessionToken)) {
        // وجدنا الـ update! نعالج المصادقة
        const userData = {
          telegramId: message.from.id,
          firstName: message.from.first_name,
          lastName: message.from.last_name || null,
          username: message.from.username || null,
          photoUrl: null,
        }

        // تسجيل الدخول فعلياً — مرة واحدة فقط هنا
        const loginResult = await performLogin(userData)
        if (loginResult.error) {
          return NextResponse.json({ status: loginResult.status, error: loginResult.error })
        }

        // تحديث الـ session في Redis
        await updateTelegramSession(sessionToken, {
          ...session,
          used: true,
          userData,
          user: loginResult.user,
        })

        // إرسال رسالة تأكيد للمستخدم
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

        return NextResponse.json({ status: 'success', user: loginResult.user })
      }
    }

    // لم نجد update بهذا الـ token بعد
    return NextResponse.json({ status: 'pending' })
  } catch (err) {
    console.error('[telegram poll] failed:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ status: 'pending' })
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

    // إنشاء role cookie — مرة واحدة فقط
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
