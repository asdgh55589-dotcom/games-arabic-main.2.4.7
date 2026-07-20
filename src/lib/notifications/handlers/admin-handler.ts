import { db } from '@/lib/db'
import { sendRealtimeNotification } from '../realtime'

type AdminNotificationType = 'user_register' | 'request' | 'report' | 'milestone'

interface AdminNotificationData {
  username?: string
  title?: string
  reason?: string
  milestone?: string
  [key: string]: any
}

export async function handleAdminNotification(
  type: AdminNotificationType,
  data: AdminNotificationData
) {
  const admins = await db.user.findMany({
    where: { role: 'admin' }
  })

  const templates: Record<AdminNotificationType, { title: string; message: string }> = {
    user_register: {
      title: 'مستخدم جديد',
      message: `تم تسجيل مستخدم جديد: ${data.username}`
    },
    request: {
      title: 'طلب تعريب جديد',
      message: `أرسل طلب تعريب جديد: ${data.title}`
    },
    report: {
      title: 'بلاغ عن محتوى',
      message: `تم الإبلاغ عن: ${data.reason}`
    },
    milestone: {
      title: 'إنجاز جديد',
      message: `تم تحقيق هدف: ${data.milestone}`
    }
  }

  const template = templates[type]

  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        type: 'admin',
        title: template.title,
        message: template.message,
        data
      }
    })

    await sendRealtimeNotification(admin.id)
  }
}
