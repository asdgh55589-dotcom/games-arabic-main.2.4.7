import { db } from '@/lib/db'
import { NotificationType } from '@/lib/notifications/types'

const typeMap: Record<string, NotificationType> = {
  user_register: NotificationType.AdminUserRegister,
  request: NotificationType.AdminRequest,
  report: NotificationType.AdminReport,
  milestone: NotificationType.AdminMilestone,
}

interface AdminNotificationData {
  username?: string
  title?: string
  reason?: string
  milestone?: string
  [key: string]: any
}

export async function handleAdminNotification(type: string, data: AdminNotificationData) {
  const admins = await db.user.findMany({
    where: { role: 'admin' },
  })

  const templates: Record<string, { title: string; message: string }> = {
    user_register: {
      title: 'مستخدم جديد',
      message: `تم تسجيل مستخدم جديد: ${data.username}`,
    },
    request: {
      title: 'طلب تعريب جديد',
      message: `أرسل طلب تعريب جديد: ${data.title}`,
    },
    report: {
      title: 'بلاغ عن محتوى',
      message: `تم الإبلاغ عن: ${data.reason}`,
    },
    milestone: {
      title: 'إنجاز جديد',
      message: `تم تحقيق هدف: ${data.milestone}`,
    },
  }

  const template = templates[type]
  const notificationType = typeMap[type] ?? NotificationType.AdminAction

  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        type: notificationType,
        title: template.title,
        message: template.message,
        data,
      },
    })
  }
}
