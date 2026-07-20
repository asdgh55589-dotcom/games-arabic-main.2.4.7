import { db } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface GroupedNotifications {
  likes: any[]
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

      ${grouped.likes.length > 0 ? `
        <div class="section">
          <h2>إعجابات (${grouped.likes.length})</h2>
          ${grouped.likes.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      ${grouped.comments.length > 0 ? `
        <div class="section">
          <h2>تعليقات (${grouped.comments.length})</h2>
          ${grouped.comments.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      ${grouped.admin.length > 0 ? `
        <div class="section">
          <h2>إشعارات إدارية (${grouped.admin.length})</h2>
          ${grouped.admin.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

      ${grouped.system.length > 0 ? `
        <div class="section">
          <h2>إشعارات النظام (${grouped.system.length})</h2>
          ${grouped.system.map(n => `
            <div class="notification">${n.message}</div>
          `).join('')}
        </div>
      ` : ''}

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
      isRead: false
    },
    orderBy: { createdAt: 'desc' }
  })

  if (unreadNotifications.length === 0) return

  const grouped: GroupedNotifications = {
    likes: unreadNotifications.filter(n => n.type === 'like'),
    comments: unreadNotifications.filter(n => n.type === 'comment'),
    admin: unreadNotifications.filter(n => n.type === 'admin'),
    system: unreadNotifications.filter(n => n.type === 'system')
  }

  const user = await db.user.findUnique({
    where: { id: userId }
  })

  if (!user?.email) return

  await resend.emails.send({
    from: 'notifications@yourdomain.com',
    to: user.email,
    subject: `ملخص إشعاراتك - ${unreadNotifications.length} إشعار جديد`,
    html: generateSummaryTemplate(grouped)
  })

  await db.notificationLog.create({
    data: {
      notificationId: unreadNotifications[0].id,
      channel: 'email',
      status: 'sent',
      sentAt: new Date()
    }
  })
}
