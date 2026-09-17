import { emailFrom } from '@/lib/email/from'
import { emailProvider } from '@/lib/email'

// ===== Creator Program Approval Email =====

export async function sendCreatorApprovalEmail(
  to: string,
  opts: { username: string; track: 'publisher' | 'translator'; approveNote?: string },
): Promise<void> {
  const isPublisher = opts.track === 'publisher'
  const trackName = isPublisher ? 'ناشر' : 'معرّب'
  const nextSteps = isPublisher
    ? 'يمكنك الآن نشر المحتوى والأخبار من لوحة منشئ المحتوى.'
    : 'يمكنك الآن رفع تعريباتك ومشاركتها مع المجتمع من لوحة منشئ المحتوى.'
  const noteHtml = opts.approveNote
    ? `<p><strong>ملاحظة من المراجعة:</strong> ${opts.approveNote}</p>`
    : ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''

  // SA-2 template path (src/lib/email/templates.ts renders DB-row templates
  // and returns null when deferred/absent) — inline fallback below is
  // byte-identical to the pre-Emitlo copy. The require is inside
  // try/catch so this sender survives templates.ts being absent.
  let rendered: { subject: string; html: string; text?: string } | null = null
  try {
    const mod = require('@/lib/email/templates') as typeof import('@/lib/email/templates')
    rendered =
      mod.renderEmailTemplate('creator-approval', 'ar', {
        username: opts.username,
        track: opts.track,
        approveNote: opts.approveNote ?? '',
        appUrl,
      }) ?? null
  } catch {
    rendered = null
  }

  const subject = rendered?.subject ?? `مبروك! انضممت لبرنامج منشئ المحتوى ك${trackName}`
  const html =
    rendered?.html ??
    REPORT_EMAIL_TEMPLATE(
      `مبروك! انضممت لبرنامج منشئ المحتوى ك${trackName}`,
      `<p>مرحباً ${opts.username}،</p>
     <p>تم قبول طلب انضمامك إلى برنامج منشئ المحتوى بمسار <strong>${trackName}</strong>.</p>
     <p>${nextSteps}</p>
     ${noteHtml}
     <p><a class="btn" href="${appUrl}/creator">افتح لوحة منشئ المحتوى</a></p>`,
    )

  try {
    const result = await emailProvider.send({
      from: emailFrom(),
      to: [to],
      subject,
      html,
      ...(rendered?.text ? { text: rendered.text } : {}),
    })
    if (!result.ok) {
      console.warn('[Emitlo] Skipping email — send failed (sendCreatorApprovalEmail)', result.reason)
    }
  } catch (err) {
    console.error('[email] failed to send creator approval email:', err)
  }
}

// ===== Report Email Notifications =====

const REPORT_EMAIL_TEMPLATE = (title: string, body: string) => `  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; direction: rtl; background: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; line-height: 1.6; color: #333; }
      .footer { padding: 15px 20px; background: #f9fafb; text-align: center; font-size: 12px; color: #666; }
      .btn { display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header"><h1>${title}</h1></div>
      <div class="content">${body}</div>
      <div class="footer">منصة تعريب الألعاب — هذا إشعار تلقائي</div>
    </div>
  </body>
  </html>
`
