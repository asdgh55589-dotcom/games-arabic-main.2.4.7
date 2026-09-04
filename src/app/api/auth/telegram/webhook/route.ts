import type { NextRequest } from 'next/server'
import { redisGet, redisSet } from '@/lib/redis'
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
    if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
      console.error('[Telegram webhook] TELEGRAM_BOT_TOKEN not configured')
      return internalError('خدمة Telegram غير مهيأة حالياً')
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

    const rawSession = await redisGet<any>(`telegram_session:${sessionToken}`)
    if (!rawSession) {
      await sendMessage(
        botToken,
        user.id,
        '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.',
      )
      return ok({ ok: true })
    }

    // redisGet يعيد object (بعد JSON.parse) في حالة memory fallback، أو string في حالة Upstash
    let session: any = rawSession
    if (typeof rawSession === 'string') {
      try {
        session = JSON.parse(rawSession)
      } catch {
        session = null
      }
    }
    if (!session || typeof session.expiresAt !== 'number') {
      await sendMessage(
        botToken,
        user.id,
        '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.',
      )
      return ok({ ok: true })
    }

    if (Date.now() > session.expiresAt) {
      await sendMessage(
        botToken,
        user.id,
        '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.',
      )
      return ok({ ok: true })
    }

    // محاولة جلب صورة المستخدم من Telegram (Task 8)
    let photoUrl: string | null = null
    try {
      const photosRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${user.id}&limit=1`,
      )
      const photosData = await photosRes.json().catch(() => null)
      if (photosData?.ok && photosData.result?.total_count > 0) {
        const fileId = photosData.result.photos[0][0]?.file_id
        if (fileId) {
          const fileRes = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
          )
          const fileData = await fileRes.json().catch(() => null)
          if (fileData?.ok && fileData.result?.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`
          }
        }
      }
    } catch (e) {
      console.error('[Telegram webhook] failed to fetch photo:', e)
    }

    await redisSet(
      `telegram_session:${sessionToken}`,
      {
        used: true,
        expiresAt: session.expiresAt,
        userData: {
          telegramId: user.id,
          firstName: user.first_name,
          lastName: user.last_name || null,
          username: user.username || null,
          photoUrl,
        },
      },
      300,
    )

    const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ')
    await sendMessage(
      botToken,
      user.id,
      `✅ تم تسجيل الدخول بنجاح!\n\nمرحباً ${displayName}، يمكنك الآن العودة إلى الموقع وستكون مسجّل الدخول تلقائياً.`,
    )

    return ok({ ok: true })
  } catch (err) {
    console.error(
      '[telegram webhook] failed:',
      err instanceof Error ? err.message : 'unknown error',
    )
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
