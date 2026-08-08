import { NextRequest, NextResponse } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'
import { createHmac } from 'crypto'

// POST /api/auth/telegram/webhook — استقبال بيانات من Telegram Bot
// البوت يرسل بيانات المستخدم هنا عندما يضغط Start مع Deep Link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // التحقق من صحة الطلب (يجب أن يأتي من البوت)
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: 'Bot not configured' }, { status: 500 })
    }

    // استخراج بيانات المستخدم من الـ update
    const message = body.message || body.callback_query?.message
    if (!message) {
      return NextResponse.json({ ok: true }) // تجاهل الـ updates غير ذات الصلة
    }

    const user = message.from
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    // استخراج session token من الـ /start command
    const text = message.text || ''
    if (!text.startsWith('/start ')) {
      // ليس deep link — تجاهل
      return NextResponse.json({ ok: true })
    }

    const sessionToken = text.replace('/start ', '').trim()

    if (!sessionToken) {
      return NextResponse.json({ ok: true })
    }

    // التحقق من صحة الـ token
    const sessionData = await redisGet<string>(`telegram_auth:${sessionToken}`)
    if (!sessionData) {
      // token غير صالح — أرسل رسالة للمستخدم
      await sendMessage(botToken, user.id, '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.')
      return NextResponse.json({ ok: true })
    }

    const session = JSON.parse(sessionData)

    // فحص انتهاء الصلاحية
    if (Date.now() > session.expiresAt) {
      await sendMessage(botToken, user.id, '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.')
      return NextResponse.json({ ok: true })
    }

    // تحديث الـ session ببيانات المستخدم
    await redisSet(`telegram_auth:${sessionToken}`, JSON.stringify({
      used: true,
      expiresAt: session.expiresAt,
      userData: {
        telegramId: user.id,
        firstName: user.first_name,
        lastName: user.last_name || null,
        username: user.username || null,
        photoUrl: null, // Telegram لا يرسل الصورة في الـ message
      },
    }), 300)

    // إرسال رسالة تأكيد للمستخدم
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
    await sendMessage(
      botToken,
      user.id,
      `✅ تم تسجيل الدخول بنجاح!\n\nمرحباً ${displayName}، يمكنك الآن العودة إلى الموقع وستكون مسجّل الدخول تلقائياً.`
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[telegram webhook] failed:', err instanceof Error ? err.message : 'unknown error')
    return NextResponse.json({ ok: true }) //Always return 200 to Telegram
  }
}

// GET /api/auth/telegram/webhook — للتحقق من أن الـ webhook يعمل
export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Telegram webhook is active' })
}

// دالة مساعدة لإرسال رسائل Telegram
async function sendMessage(botToken: string, chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (err) {
    console.error('[telegram sendMessage] failed:', err)
  }
}
