/**
 * lib/email/index.ts — transport selector (Brevo-first, Emitlo fallback).
 *
 * Resolution (read per call so tests and runtime config reloads just work):
 * - EMAIL_PROVIDER=brevo  → Brevo, strictly (missing key = not-configured).
 * - EMAIL_PROVIDER=emitlo → Emitlo, strictly (missing key = not-configured).
 * - auto (default) / anything else → Brevo when BREVO_API_KEY is set,
 *   else Emitlo when EMITLO_API_KEY is set, else a dev-log fallback that
 *   returns { ok: false, reason: 'not-configured' } without network.
 *
 * All providers implement the shared EmailProvider contract, so callers
 * keep one import and one `.send()` shape regardless of transport.
 */

import { logger } from '@/lib/logger'
import { brevoProvider } from './brevo'
import { emitloProvider } from './emitlo'
import type { EmailProvider } from './provider'

export type EmailProviderName = 'brevo' | 'emitlo' | 'none'

/** Which transport would be used right now (no side effects). */
export function resolveEmailProvider(): EmailProviderName {
  const forced = (process.env.EMAIL_PROVIDER || 'auto').trim().toLowerCase()
  if (forced === 'brevo') return 'brevo'
  if (forced === 'emitlo') return 'emitlo'
  if (process.env.BREVO_API_KEY) return 'brevo'
  if (process.env.EMITLO_API_KEY) return 'emitlo'
  return 'none'
}

const devFallback: EmailProvider = {
  async send(msg) {
    // eslint-disable-next-line no-console
    console.log('[EMAIL-DEV] Would send:', { to: msg.to, subject: msg.subject })
    return { ok: false, reason: 'not-configured' }
  },
};

/** True when at least one transport can send (Brevo preferred). */
export function hasEmailProvider(): boolean {
  return Boolean(process.env.BREVO_API_KEY || process.env.EMITLO_API_KEY)
}

/** The active transport. Same EmailProvider contract as each adapter. */
export const emailProvider: EmailProvider = {
  async send(msg) {
    const name = resolveEmailProvider()
    if (name === 'brevo') return brevoProvider.send(msg)
    if (name === 'emitlo') return emitloProvider.send(msg)
    if (process.env.NODE_ENV !== 'production') {
      return devFallback.send(msg)
    }
    logger.warn('[email] no email provider configured — email not sent')
    return { ok: false, reason: 'not-configured' }
  },
}

export interface SendEmailOptions {
  to: string[]
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/** Convenience adapter over emailProvider with a plain success/error shape. */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { emailFrom } = await import('./from')
  const result = await emailProvider.send({
    from: emailFrom(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.text ? { text: options.text } : {}),
  })
  if (result.ok) {
    return {
      success: true,
      ...(result.providerMessageId ? { messageId: result.providerMessageId } : {}),
    }
  }
  return { success: false, ...(result.reason ? { error: result.reason } : {}) }
}
