/**
 * lib/verification-email.ts — email-verification mailer (setup-added emails).
 *
 * Thin wrapper over the Emitlo provider, mirroring lib/recovery-email.ts
 * exactly (same dev-console fallback, same template-then-inline pattern).
 * Callers return explicit sent/unsent signals — a send failure must surface
 * to the authenticated user as "retry/resend", never silently.
 */

import { emailFrom } from '@/lib/email/from'
import { emitloProvider } from '@/lib/email/emitlo'
import { logger } from '@/lib/logger'

/** Verification links live 24h (friendlier than the 1h recovery window). */
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

/** Max verification mails per user per rolling hour (DB-counted, restart-safe). */
export const RESEND_MAX_PER_HOUR = 3

export function buildVerifyLink(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/verify-email-address?token=${encodeURIComponent(rawToken)}`
}

export async function sendVerificationEmail(to: string, verifyLink: string): Promise<boolean> {
  try {
    if (!process.env.EMITLO_API_KEY) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[verification:dev] verify link for ${to}: ${verifyLink}`)
      } else {
        logger.warn('[verification] EMITLO_API_KEY not configured — verification email not sent')
      }
      return false
    }
    let rendered: { subject: string; html: string; text?: string } | null = null
    try {
      const mod = require('@/lib/email/templates') as typeof import('@/lib/email/templates')
      rendered =
        mod.renderEmailTemplate('email-verification', 'ar', { verifyLink }) ?? null
    } catch {
      rendered = null
    }
    const subject = rendered?.subject ?? 'تأكيد بريدك الإلكتروني — GAMES ARABIC'
    const html =
      rendered?.html ??
      `
        <div dir="rtl" lang="ar" style="font-family: Arial, sans-serif;">
          <h2>تأكيد بريدك الإلكتروني</h2>
          <p>أضفت هذا البريد إلى حسابك. الرابط صالح لمدة ٢٤ ساعة ولاستخدام واحد فقط.</p>
          <p><a href="${verifyLink}">اضغط هنا لتأكيد بريدك الإلكتروني</a></p>
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
      logger.warn('[verification] emitlo send failed', { message: result.reason })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[verification] send failed', err)
    return false
  }
}
