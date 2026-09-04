import type { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { redisGet, redisSet } from '@/lib/redis'

// Dev-only helper: يسحب رسائل Telegram عبر getUpdates ويعالجها داخل نفس عملية Next.js
// يحل مشكلة أن webhook لا يصل لـ localhost بدون ngrok
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return ok({ ok: false, error: 'dev-poll disabled in production' }, 403 as any)
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken || botToken === 'REPLACE_WITH_BOT_TOKEN') {
    return ok({ ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?timeout=0`)
    const data = await res.json().catch(() => null)

    if (!data?.ok) {
      return ok({ ok: false, error: 'getUpdates failed', details: data })
    }

    const updates: any[] = data.result || []
    let processed = 0
    let lastUpdateId = 0

    for (const upd of updates) {
      lastUpdateId = Math.max(lastUpdateId, upd.update_id || 0)
      const message = upd.message || upd.callback_query?.message
      const user = message?.from || upd.message?.from
      const text: string = message?.text || upd.message?.text || ''

      if (!user || !text.startsWith('/start ')) continue

      const sessionToken = text.replace('/start ', '').trim()
      if (!sessionToken) continue

      const rawSession = await redisGet<any>(`telegram_session:${sessionToken}`)

      if (!rawSession) {
        await sendMessage(
          botToken,
          user.id,
          '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.',
        )
        processed++
        continue
      }

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
        processed++
        continue
      }

      // تحقق انتهاء الصلاحية
      const expiresAt = session.expiresAt
      if (expiresAt && Date.now() > expiresAt) {
        await sendMessage(
          botToken,
          user.id,
          '❌ رابط تسجيل الدخول منتهي الصلاحية. يرجى المحاولة مرة أخرى من الموقع.',
        )
        processed++
        continue
      }

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
      } catch {}

      const expires = session.expiresAt || Date.now() + 5 * 60 * 1000
      await redisSet(
        `telegram_session:${sessionToken}`,
        {
          used: true,
          expiresAt: expires,
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
      processed++
    }

    // تأكيد الاستلام لمسح الطابور
    if (lastUpdateId > 0) {
      await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`,
      ).catch(() => {})
    }

    return ok({ ok: true, processed, total: updates.length })
  } catch (err) {
    return ok({ ok: false, error: err instanceof Error ? err.message : 'unknown' })
  }
}

async function sendMessage(botToken: string, chatId: number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch {}
}
