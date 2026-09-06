/**
 * lib/recovery-email.ts — password-reset mailer (D.6-c).
 *
 * Thin wrapper over Resend. Delivery depends on deployment config
 * (RESEND_API_KEY + EMAIL_FROM); in dev without Resend the link is printed
 * to the console (never in production). Callers always return generic
 * responses — a send failure must not reveal account existence.
 */

import { Resend } from 'resend'
import { logger } from '@/lib/logger'

export function buildResetLink(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[recovery:dev] reset link for ${to}: ${resetLink}`)
      } else {
        logger.warn('[recovery] RESEND_API_KEY not configured — reset email not sent')
      }
      return false
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@games-arabic.com',
      to,
      subject: 'استعادة كلمة المرور — GAMES ARABIC',
      html: `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>استعادة كلمة المرور</h2>
          <p>طلبت إعادة تعيين كلمة مرورك. الرابط صالح لمدة ساعة واحدة ولاستخدام واحد فقط.</p>
          <p><a href="${resetLink}">اضغط هنا لتعيين كلمة مرور جديدة</a></p>
          <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        </div>`,
    })
    if (error) {
      logger.warn('[recovery] resend send failed', { message: error.message })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[recovery] send failed', err)
    return false
  }
}
