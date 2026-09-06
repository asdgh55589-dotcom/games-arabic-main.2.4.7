import type { NextRequest } from 'next/server'
import { ok, validationFail } from '@/lib/api-response'
import { redisSet } from '@/lib/redis'
import { performTelegramLogin } from '@/lib/telegram-login'
import { getTelegramSession, updateTelegramSession } from '@/lib/telegram-sessions'

export async function GET(req: NextRequest) {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (!BOT_TOKEN) {
      console.error('[Telegram poll] TELEGRAM_BOT_TOKEN not configured')
      return ok({ status: 'pending', warning: 'Telegram غير مُهيأ' })
    }

    const { searchParams } = new URL(req.url)
    const sessionToken = searchParams.get('token')

    if (!sessionToken) {
      return validationFail({ token: 'token required' })
    }

    let session = await getTelegramSession(sessionToken)

    if (!session) {
      return ok({ status: 'pending' })
    }

    if (Date.now() > session.expiresAt) {
      return ok({ status: 'expired' })
    }

    // في وضع التطوير (localhost) الـ webhook لا يصل بدون ngrok — نحاول سحب الرسائل مباشرة عبر getUpdates
    if (process.env.NODE_ENV !== 'production' && !session.used) {
      try {
        const botToken = BOT_TOKEN!
        const updatesRes = await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?timeout=0`,
        )
        const updatesData = await updatesRes.json().catch(() => null)
        if (updatesData?.ok && Array.isArray(updatesData.result)) {
          let foundForThisToken = false
          let maxId = 0
          for (const upd of updatesData.result) {
            maxId = Math.max(maxId, upd.update_id || 0)
            const msg = upd.message || upd.callback_query?.message
            const usr = msg?.from || upd.message?.from
            const txt: string = msg?.text || upd.message?.text || ''
            if (!usr || !txt.startsWith('/start ')) continue
            const tok = txt.replace('/start ', '').trim()
            if (!tok) continue
            // معالجة فقط التوكن المطلوب أو أي توكن موجود في نفس الدفعة لتسريع العملية
            const targetSession = await getTelegramSession(tok)
            if (!targetSession) continue
            if (targetSession.used) continue
            // جلب الصورة
            let photoUrl: string | null = null
            try {
              const pRes = await fetch(
                `https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${usr.id}&limit=1`,
              )
              const pData = await pRes.json().catch(() => null)
              if (pData?.ok && pData.result?.total_count > 0) {
                const fid = pData.result.photos[0][0]?.file_id
                if (fid) {
                  const fRes = await fetch(
                    `https://api.telegram.org/bot${botToken}/getFile?file_id=${fid}`,
                  )
                  const fData = await fRes.json().catch(() => null)
                  if (fData?.ok && fData.result?.file_path)
                    photoUrl = `https://api.telegram.org/file/bot${botToken}/${fData.result.file_path}`
                }
              }
            } catch {}
            await redisSet(
              `telegram_session:${tok}`,
              {
                used: true,
                expiresAt: targetSession.expiresAt,
                userData: {
                  telegramId: usr.id,
                  firstName: usr.first_name,
                  lastName: usr.last_name || null,
                  username: usr.username || null,
                  photoUrl,
                },
              },
              300,
            )
            const dName = [usr.first_name, usr.last_name].filter(Boolean).join(' ')
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: usr.id,
                text: `✅ تم تسجيل الدخول بنجاح!\n\nمرحباً ${dName}، يمكنك الآن العودة إلى الموقع وستكون مسجّل الدخول تلقائياً.`,
              }),
            }).catch(() => {})
            if (tok === sessionToken) foundForThisToken = true
          }
          if (maxId > 0) {
            await fetch(
              `https://api.telegram.org/bot${botToken}/getUpdates?offset=${maxId + 1}&timeout=0`,
            ).catch(() => {})
          }
          if (foundForThisToken) {
            session = await getTelegramSession(sessionToken)
            if (!session) return ok({ status: 'pending' })
          }
        }
      } catch (e) {
        console.warn('[telegram poll dev] getUpdates failed:', e)
      }
    }

    if (!session) return ok({ status: 'pending' })

    // إذا اكتملت عبر الـ webhook (session.used && userData) ولم يُسجّل الدخول بعد — قم بتسجيل الدخول الآن
    if (session.used && session.userData && !session.user) {
      const loginResult = await performTelegramLogin(session.userData, {
        ipAddress:
          req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip'),
        userAgent: req.headers.get('user-agent'),
      })
      if (!loginResult.ok) {
        return ok({ status: loginResult.status, error: loginResult.error })
      }
      await updateTelegramSession(sessionToken, {
        ...session,
        user: loginResult.user,
      })
      return ok({ status: 'success', user: loginResult.user })
    }

    if (session.used && session.user) {
      return ok({ status: 'success', user: session.user })
    }

    // لا يزال في انتظار تأكيد المستخدم عبر Telegram — الـ webhook هو المسؤول عن استقبال /start
    return ok({ status: 'pending' })
  } catch (err) {
    console.error('[telegram poll] failed:', err instanceof Error ? err.message : 'unknown error')
    return ok({ status: 'pending' })
  }
}
