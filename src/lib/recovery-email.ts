/**
 * lib/recovery-email.ts — password-reset mailer (D.6-c).
 *
 * Thin wrapper over the active email provider (Brevo-first, Emitlo
 * fallback — see lib/email/index.ts). Delivery depends on deployment
 * config (BREVO_API_KEY or EMITLO_API_KEY + EMAIL_FROM); in dev without a
 * provider the link is printed to the console (never in production).
 * Callers always return generic responses — a send failure must not reveal
 * account existence.
 */

import { emailFrom } from '@/lib/email/from'
import { emailProvider, hasEmailProvider } from '@/lib/email'
import { buildResetEmail } from '@/lib/email/templates'
import { logger } from '@/lib/logger'

export function buildResetLink(baseUrl: string, rawToken: string): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/reset-password?token=${encodeURIComponent(rawToken)}`
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  try {
    if (!hasEmailProvider()) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[recovery:dev] reset link for ${to}: ${resetLink}`)
      } else {
        logger.warn('[recovery] no email provider configured — reset email not sent')
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
    const subject = rendered?.subject ?? buildResetEmail(resetLink).subject
    const html = rendered?.html ?? buildResetEmail(resetLink).html
    const result = await emailProvider.send({
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
