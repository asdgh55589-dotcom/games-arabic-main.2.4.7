import { Resend } from 'resend'
import { db } from '@/lib/db'

let resend: Resend | null = null
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY)
} else {
  console.warn('[Resend] RESEND_API_KEY not configured — email sending disabled')
}

interface InactiveAlertData {
  inactiveUsers: Array<{
    username: string
    email: string
    lastLoginAt: Date | null
    daysSinceLastLogin: number | null
    modCount: number
    totalDownloads: number
  }>
  daysThreshold: number
}

function generateAlertTemplate(data: InactiveAlertData): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; direction: rtl; margin: 0; padding: 0; }
        .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .user-item { border-bottom: 1px solid #eee; padding: 10px 0; }
        .stats { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>تنبيه: مستخدمون خاملون</h1>
      </div>
      <div class="content">
        <div class="stats">
          <p>تم اكتشاف <strong>${data.inactiveUsers.length}</strong> مستخدم خامل منذ أكثر من <strong>${data.daysThreshold}</strong> يوم.</p>
        </div>
        <h2>قائمة المستخدمين الخاملين:</h2>
        ${data.inactiveUsers
          .map(
            (user) => `
          <div class="user-item">
            <strong>${user.username}</strong> - ${user.email}<br>
            آخر دخول: ${user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('ar') : 'لم يسجل دخول'}<br>
            التعريبات: ${user.modCount} | التحميلات: ${user.totalDownloads.toLocaleString()}
          </div>
        `,
          )
          .join('')}
      </div>
    </body>
    </html>
  `
}

export async function sendInactiveUserAlert(data: InactiveAlertData) {
  if (!resend) {
    console.warn('[Resend] Skipping email — API key not configured (sendInactiveUserAlert)')
    return
  }

  const admins = await db.user.findMany({
    where: { role: 'admin' },
  })

  const html = generateAlertTemplate(data)

  for (const admin of admins) {
    await resend.emails.send({
      from: 'alerts@yourdomain.com',
      to: admin.email,
      subject: `تنبيه: ${data.inactiveUsers.length} مستخدم خامل`,
      html,
    })
  }

  await db.auditLog.create({
    data: {
      action: 'inactive_alert',
      entity: 'user',
      details: JSON.stringify({
        inactiveCount: data.inactiveUsers.length,
        daysThreshold: data.daysThreshold,
      }),
    },
  })
}
