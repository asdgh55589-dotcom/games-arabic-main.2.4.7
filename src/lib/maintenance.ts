import { requireOwner } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * قراءة إعدادات الصيانة من قاعدة البيانات.
 *
 * ملاحظات:
 * - المفاتيح محفوظة بتنسيق "maintenance_<key>" في جدول SiteSetting.
 * - لو الإعداد غير موجود → نرجع القيم الافتراضية (الصيانة مطفّاة).
 */
export async function getMaintenanceSettings() {
  const settings = await db.siteSetting.findMany({
    where: { group: 'maintenance' },
  })

  const map: Record<string, string> = {}
  for (const s of settings) {
    map[s.key] = s.value
  }

  return {
    enabled: map['enabled'] === 'true',
    title: map['title'] || 'الموقع تحت الصيانة',
    message: map['message'] || 'نعمل حاليًا على تحسين الموقع. نرجع قريبًا!',
  }
}
