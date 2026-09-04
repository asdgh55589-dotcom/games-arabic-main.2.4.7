import { Resend } from 'resend'
import { db } from '@/lib/db'

let resend: Resend | null = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else {
  console.warn('[Resend] RESEND_API_KEY not configured — email sending disabled')
}

interface GroupedNotifications {
  endorsements: any[]
  comments: any[]
  admin: any[]
  system: any[]
}

function generateSummaryTemplate(grouped: GroupedNotifications): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; }
        .header { background: #2563eb; color: white; padding: 20px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .notification { padding: 10px; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>ملخص إشعاراتك</h1>
      </div>

      ${
        grouped.endorsements.length > 0
          ? `
        <div class="section">
          <h2>إعجابات (${grouped.endorsements.length})</h2>
          ${grouped.endorsements
            .map(
              (n) => `
            <div class="notification">${n.message}</div>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        grouped.comments.length > 0
          ? `
        <div class="section">
          <h2>تعليقات (${grouped.comments.length})</h2>
          ${grouped.comments
            .map(
              (n) => `
            <div class="notification">${n.message}</div>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        grouped.admin.length > 0
          ? `
        <div class="section">
          <h2>إشعارات إدارية (${grouped.admin.length})</h2>
          ${grouped.admin
            .map(
              (n) => `
            <div class="notification">${n.message}</div>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        grouped.system.length > 0
          ? `
        <div class="section">
          <h2>إشعارات النظام (${grouped.system.length})</h2>
          ${grouped.system
            .map(
              (n) => `
            <div class="notification">${n.message}</div>
          `,
            )
            .join('')}
        </div>
      `
          : ''
      }

      <div class="section">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/notifications">
          عرض جميع الإشعارات
        </a>
      </div>
    </body>
    </html>
  `
}

export async function generateDailySummary(userId: string) {
  const unreadNotifications = await db.notification.findMany({
    where: {
      userId,
      isRead: false,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (unreadNotifications.length === 0) return

  const grouped: GroupedNotifications = {
    endorsements: unreadNotifications.filter(
      (n) => n.type === 'mod_endorse' || n.type === 'mod_endorse_milestone',
    ),
    comments: unreadNotifications.filter((n) => n.type === 'comment_reply' || n.type === 'like'),
    admin: unreadNotifications.filter(
      (n) =>
        n.type === 'admin_action' ||
        n.type === 'admin_user_register' ||
        n.type === 'admin_request' ||
        n.type === 'admin_report' ||
        n.type === 'admin_milestone',
    ),
    system: unreadNotifications.filter(
      (n) =>
        n.type === 'tier_upgrade' ||
        n.type === 'special_role_assigned' ||
        n.type === 'special_role_removed' ||
        n.type === 'mod_featured',
    ),
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  })

  if (!user?.email) return

  if (!resend) {
    console.warn('[Resend] Skipping email — API key not configured (generateDailySummary)')
    return
  }

  await resend.emails.send({
    from: 'notifications@yourdomain.com',
    to: user.email,
    subject: `ملخص إشعاراتك - ${unreadNotifications.length} إشعار جديد`,
    html: generateSummaryTemplate(grouped),
  })

  await db.notificationLog.create({
    data: {
      notificationId: unreadNotifications[0].id,
      channel: 'email',
      status: 'sent',
      sentAt: new Date(),
    },
  })
}

// ===== Report Email Notifications =====

const REPORT_EMAIL_TEMPLATE = (title: string, body: string) => `
  <!DOCTYPE html>
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

export async function sendReportConfirmedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string },
): Promise<void> {
  const reasonLabels: Record<string, string> = {
    spam: 'محتوى مزعج',
    inappropriate: 'محتوى غير لائق',
    copyright: 'انتهاك حقوق',
    offensive: 'محتوى مسيء',
    false_info: 'معلومات كاذبة',
    technical: 'مشكلة تقنية',
    other: 'سبب آخر',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }

  const html = REPORT_EMAIL_TEMPLATE(
    'تأكيد البلاغ',
    `<p>مرحباً،</p>
     <p>تم تأكيد بلاغك على <strong>${targetLabels[report.targetType] || report.targetType}</strong> بسبب: <strong>${reasonLabels[report.reason] || report.reason}</strong>.</p>
     <p>شكراً لمساهمتك في تحسين المنصة.</p>`,
  )

  if (!resend) {
    console.warn('[Resend] Skipping email — API key not configured (sendReportConfirmedEmail)')
    return
  }

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: reporterEmail,
      subject: 'تأكيد البلاغ — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report confirmed email:', err)
  }
}

export async function sendReportRejectedEmail(
  reporterEmail: string,
  report: { reason: string; targetType: string; resolution?: string },
): Promise<void> {
  const reasonLabels: Record<string, string> = {
    spam: 'محتوى مزعج',
    inappropriate: 'محتوى غير لائق',
    copyright: 'انتهاك حقوق',
    offensive: 'محتوى مسيء',
    false_info: 'معلومات كاذبة',
    technical: 'مشكلة تقنية',
    other: 'سبب آخر',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'مستخدم' }

  const resolutionText = report.resolution ? `<p>ملاحظات المراجعة: ${report.resolution}</p>` : ''

  const html = REPORT_EMAIL_TEMPLATE(
    'نتيجة مراجعة البلاغ',
    `<p>مرحباً،</p>
     <p>تمت مراجعة بلاغك على <strong>${targetLabels[report.targetType] || report.targetType}</strong> بسبب: <strong>${reasonLabels[report.reason] || report.reason}</strong>.</p>
     <p>لم نجد مخالفة في المحتوى المُبلَّغ.</p>
     ${resolutionText}
     <p>إذا كنت تعتقد أن هذه النتيجة خاطئة، يمكنك تقديم بلاغ جديد مع أدلة إضافية.</p>`,
  )

  if (!resend) {
    console.warn('[Resend] Skipping email — API key not configured (sendReportRejectedEmail)')
    return
  }

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: reporterEmail,
      subject: 'نتيجة مراجعة البلاغ — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report rejected email:', err)
  }
}

export async function sendReportActionEmail(
  targetEmail: string,
  report: { reason: string; targetType: string },
  action: string,
): Promise<void> {
  const actionLabels: Record<string, string> = {
    warned: 'تحذير',
    content_hidden: 'إخفاء محتوى',
    content_deleted: 'حذف محتوى',
    temp_ban: 'تعليق مؤقت',
    perm_ban: 'حظر دائم',
  }
  const targetLabels: Record<string, string> = { mod: 'تعريب', comment: 'تعليق', user: 'حسابك' }

  const html = REPORT_EMAIL_TEMPLATE(
    'إشعار إداري — اتُّخذ إجراء',
    `<p>مرحباً،</p>
     <p>بناءً على بلاغ مقدم ضد <strong>${targetLabels[report.targetType] || report.targetType}</strong>، تمت مراجعة المحتوى واتُّخذ الإجراء التالي:</p>
     <p><strong>${actionLabels[action] || action}</strong></p>
     <p>إذا كان لديك أي استفسار، يُرجى التواصل مع فريق الدعم.</p>`,
  )

  if (!resend) {
    console.warn('[Resend] Skipping email — API key not configured (sendReportActionEmail)')
    return
  }

  try {
    await resend.emails.send({
      from: 'notifications@yourdomain.com',
      to: targetEmail,
      subject: 'إشعار إداري — منصة تعريب الألعاب',
      html,
    })
  } catch (err) {
    console.error('[email] failed to send report action email:', err)
  }
}
