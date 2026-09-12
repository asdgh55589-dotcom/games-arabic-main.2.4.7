/**
 * lib/email/provider.ts — provider-agnostic email contract (SA-1).
 *
 * No dependencies. All senders code against EmailProvider so the
 * underlying transport (Emitlo, SMTP, …) can be swapped without
 * touching caller logic. Fail-open: send() NEVER throws — every
 * failure is a { ok: false, reason } result.
 */

export interface EmailMessage {
  from: string
  to: string[]
  subject: string
  html: string
  text?: string
  requestId?: string
}

export interface EmailResult {
  ok: boolean
  reason?: string
  providerMessageId?: string
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailResult>
}
