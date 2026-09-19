/**
 * lib/password-changed-email.ts — post-change notification sender.
 *
 * Thin wrapper over the active email provider (Brevo-first, Emitlo
 * fallback). Fail-open by contract: returns false (never throws) when no
 * provider is configured or delivery fails — callers must not block auth
 * flows on the result. Used as the email backup leg for critical security
 * events (see lib/notification-router.ts).
 */

import { emailFrom } from '@/lib/email/from'
import { emailProvider, hasEmailProvider } from '@/lib/email'
import { buildPasswordChangedEmail } from '@/lib/email/templates'
import { logger } from '@/lib/logger'

export async function sendPasswordChangedEmail(
  to: string,
  vars: { username: string; changedAt: string; ip: string | null },
): Promise<boolean> {
  try {
    if (!hasEmailProvider()) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[password-changed:dev] notification for ${to}`)
      }
      return false
    }
    const built = buildPasswordChangedEmail(vars)
    const result = await emailProvider.send({
      from: emailFrom(),
      to: [to],
      subject: built.subject,
      html: built.html,
      text: built.text,
    })
    if (!result.ok) {
      logger.warn('[password-changed] send failed', { message: result.reason })
      return false
    }
    return true
  } catch (err) {
    logger.warn('[password-changed] send failed', err)
    return false
  }
}
