/**
 * Email Base Wrapper — الغلاف الأساسي لرسائل البريد الإلكتروني
 * Professional RTL Arabic HTML layout for all notification emails.
 */

export interface EmailTemplateData {
  title: string
  body: string
  recipientName?: string
  actionUrl?: string
  actionLabel?: string
  logId?: string
}

/**
 * Wraps email content in a professional RTL Arabic HTML layout.
 * Used as the outer shell for all notification emails.
 */
export function generateEmailWrapper(data: EmailTemplateData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const trackingPixel =
    data.logId && baseUrl
      ? `<img src="${baseUrl}/api/notifications/track?id=${data.logId}&event=open" width="1" height="1" style="display:none" alt="" />`
      : ''
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:20px;">منصة تعريب الألعاب</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${data.body}
            </td>
          </tr>
          <!-- Action Button -->
          ${
            data.actionUrl
              ? `
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${sanitizeUrl(data.actionUrl)}" style="display:inline-block;background-color:#6c5ce7;color:#ffffff;padding:12px 32px;border-radius:6px;text-decoration:none;font-size:16px;">
                ${escapeHtml(data.actionLabel ?? 'عرض التفاصيل')}
              </a>
            </td>
          </tr>
          `
              : ''
          }
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:24px 32px;text-align:center;border-top:1px solid #e9ecef;">
              <p style="color:#6c757d;margin:0;font-size:12px;">
                هذه الرسالة أُرسلت تلقائيًا من منصة تعريب الألعاب.
                <br>إذا كنت لا ترغب في استلام هذه الإشعارات، يمكنك تعديل تفضيلاتك من إعدادات حسابك.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`
}

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Sanitize URL to prevent javascript:/data: XSS attacks */
function sanitizeUrl(url: string): string {
  const trimmed = url.trim().toLowerCase()
  if (/^\s*(javascript|data|vbscript)\s*:/i.test(trimmed)) {
    return '#'
  }
  return escapeHtml(url)
}
