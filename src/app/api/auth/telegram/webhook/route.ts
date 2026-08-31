import { NextRequest } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'
import { createHmac } from 'crypto'
import { ok, internalError } from '@/lib/api-response'

export async function POST(req: NextRequest) {
  try {
    // Verify Telegram webhook secret token
    const secretToken = req.headers.get('x-telegram-bot-api-secret-token')
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
    if (!expectedSecret) {
      console.error('[telegram webhook] TELEGRAM_WEBHOOK_SECRET not configured')
      return ok({ ok: true })
    }
    if (!secretToken || secretToken !== expectedSecret) {
      console.warn('[telegram webhook] Invalid secret token')
      return ok({ ok: true }) // Return 200 to prevent Telegram from retrying
    }

    const body = await req.json()

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return internalError('Bot not configured')
    }

    const message = body.message || body.callback_query?.message
    if (!message) {
      return ok({ ok: true })
    }

    const user = message.from
    if (!user) {
      return ok({ ok: true })
    }

    const text = message.text || ''
    if (!text.startsWith('/start ')) {
      return ok({ ok: true })
    }

    const sessionToken = text.replace('/start ', '').trim()

    if (!sessionToken) {
      return ok({ ok: true })
    }

    const sessionData = await redisGet<string>(`telegram_session:${sessionToken}`)
    if (!sessionData) {
      await sendMessage(botToken, user.id, '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.')
      return ok({ ok: true })
    }

    const session = JSON.parse(sessionData)

    if (Date.now() > session.expiresAt) {
      await sendMessage(botToken, user.id, '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.')
      return ok({ ok: true })
    }

    await redisSet(`telegram_session:${sessionToken}`, JSON.stringify({
      used: true,
      expiresAt: session.expiresAt,
      userData: {
        telegramId: user.id,
        firstName: user.first_name,
        lastName: user.last_name || null,
        username: user.username || null,
        photoUrl: null,
      },
    }), 300)

    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
    await sendMessage(
      botToken,
      user.id,
      `✅ تم تسجيل الدخول بنجاح!\n\nمرحباً ${displayName}، يمكنك الآن العودة إلى الموقع وستكون مسجّل الدخول تلقائياً.`
    )

    return ok({ ok: true })
  } catch (err) {
    console.error('[telegram webhook] failed:', err instanceof Error ? err.message : 'unknown error')
    return ok({ ok: true })
  }
}

export async function GET() {
  return ok({ status: 'ok', message: 'Telegram webhook is active' })
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
