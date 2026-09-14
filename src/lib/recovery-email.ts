/**
 * lib/recovery-email.ts — password-reset mailer (D.6-c).
 *
 * Thin wrapper over the Emitlo provider. Delivery depends on deployment
 * config (EMITLO_API_KEY + EMAIL_FROM); in dev without a key the link is
 * printed to the console (never in production). Callers always return
 * generic responses — a send failure must not reveal account existence.
 */

import { emailFrom } from '@/lib/email/from'
import { emitloProvider } from '@/lib/email/emitlo'
import { logger } from '@/lib/logger'

export function buildResetLink(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  try {
    if (!process.env.EMITLO_API_KEY) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[recovery:dev] reset link for ${to}: ${resetLink}`)
      } else {
        logger.warn('[recovery] EMITLO_API_KEY not configured — reset email not sent')
      }
      return false
    }
    // SA-2 template path — inline fallback below is byte-identical to the
    // previous copy. The require is inside try/catch so this sender
    // survives templates.ts being absent.
    let rendered: { subject: string; html: string; text?: string } | null = null
    try {
      const mod = require('@/lib/email/templates') as typeof import('@/lib/email/templates')
      rendered =
        mod.renderEmailTemplate('password-reset', 'ar', { resetLink }) ?? null
    } catch {
      rendered = null
    }
    const subject = rendered?.subject ?? 'استعادة كلمة المرور — GAMES ARABIC'
    const html =
      rendered?.html ??
      `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>استعادة كلمة المرور</h2>
          <p>طلبت إعادة تعيين كلمة مرورك. الرابط صالح لمدة ساعة واحدة ولاستخدام واحد فقط.</p>
          <p><a href="${resetLink}">اضغط هنا لتعيين كلمة مرور جديدة</a></p>
          <p>إذا لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        </div>`
    const result = await emitloProvider.send({
      from: emailFrom(),
      to: [to],
      subject,
      html,
      ...(rendered?.text ? { text: rendered.text } : {}),
    })
    if (!result.ok) {
      logger.warn('[recovery] emitlo send failed', { message: result.reason })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[recovery] send failed', err)
    return false
  }
}
