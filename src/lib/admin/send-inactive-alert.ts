import { db } from '@/lib/db'
import { emailProvider, hasEmailProvider } from '@/lib/email'
import { emailFrom } from '@/lib/email/from'

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
  if (!hasEmailProvider()) {
    console.warn('[email] Skipping email — no provider configured (sendInactiveUserAlert)')
    return
  }

  const admins = await db.user.findMany({
    where: { role: 'admin' },
  })

  // SA-2 template path — inline fallback below is byte-identical to the
  // previous copy. The require is inside try/catch so this sender survives
  // templates.ts being absent.
  let rendered: { subject: string; html: string; text?: string } | null = null
  try {
    const mod = require('@/lib/email/templates') as typeof import('@/lib/email/templates')
    rendered =
      mod.renderEmailTemplate('inactive-alert', 'ar', {
        inactiveCount: String(data.inactiveUsers.length),
        daysThreshold: String(data.daysThreshold),
      }) ?? null
  } catch {
    rendered = null
  }

  const subject = rendered?.subject ?? `تنبيه: ${data.inactiveUsers.length} مستخدم خامل`
  const html = rendered?.html ?? generateAlertTemplate(data)

  for (const admin of admins) {
    try {
      const result = await emailProvider.send({
        from: emailFrom(),
        to: [admin.email],
        subject,
        html,
        ...(rendered?.text ? { text: rendered.text } : {}),
      })
      if (!result.ok) {
        console.warn('[Emitlo] Skipping email — send failed (sendInactiveUserAlert)', result.reason)
      }
    } catch (err) {
      console.error('[email] failed to send inactive alert email:', err)
    }
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
