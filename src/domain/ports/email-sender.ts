/**
 * EmailSender — منفذ إرسال البريد الإلكتروني
 * Interface only — implementation provided by infrastructure layer.
 */

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface EmailSender {
  /** Send an email */
  send(to: string, subject: string, html: string): Promise<EmailSendResult>
}
