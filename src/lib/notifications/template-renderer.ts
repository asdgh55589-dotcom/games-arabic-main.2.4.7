import { db } from '@/lib/db'
import Handlebars from 'handlebars'

/**
 * جلب وعرض قالب الإشعار لنوع + قناة
 * يعود إلى العنوان/الرسالة الاحتياطية إذا لم يوجد قالب
 */
export async function renderNotificationContent(
  type: string,
  channel: string,
  variables: Record<string, unknown>,
  fallback: { title: string; message: string }
): Promise<{ title: string; message: string }> {
  try {
    const template = await db.notificationTemplate.findFirst({
      where: {
        type,
        channel,
        isActive: true,
      },
    })

    if (!template) {
      return fallback
    }

    const titleTemplate = Handlebars.compile(template.titleTemplate)
    const bodyTemplate = Handlebars.compile(template.bodyTemplate)

    return {
      title: titleTemplate(variables),
      message: bodyTemplate(variables),
    }
  } catch (error) {
    console.error('[template-renderer] Error:', error)
    return fallback
  }
}
