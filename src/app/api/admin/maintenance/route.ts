import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

const MAINTENANCE_GROUP = 'maintenance'
const MAINTENANCE_ENABLED_KEY = 'enabled'
const MAINTENANCE_MESSAGE_KEY = 'message'
const MAINTENANCE_TITLE_KEY = 'title'

/**
 * قراءة إعدادات الصيانة — ترجع كل الإعدادات تحت مجموعة "maintenance"
 */
async function getMaintenanceSettings() {
  const settings = await db.siteSetting.findMany({
    where: { group: MAINTENANCE_GROUP },
  })

  const result: Record<string, string> = {}
  for (const s of settings) {
    result[s.key] = s.value
  }

  return {
    enabled: result[MAINTENANCE_ENABLED_KEY] === 'true',
    title: result[MAINTENANCE_TITLE_KEY] || 'الموقع تحت الصيانة',
    message: result[MAINTENANCE_MESSAGE_KEY] || 'نعمل حاليًا على تحسين الموقع. نرجع قريبًا!',
  }
}

/**
 * GET /api/admin/maintenance — قراءة إعدادات الصيانة
 */
export async function GET() {
  try {
    await requireOwner()
    const settings = await getMaintenanceSettings()
    return ok({ settings })
  } catch (err) {
    console.error('[maintenance GET] failed:', err)
    return internalError('Failed')
  }
}

/**
 * PUT /api/admin/maintenance — تحديث إعدادات الصيانة
 */
export async function PUT(req: NextRequest) {
  try {
    await requireOwner()
    const body = await req.json()
    const { enabled, title, message } = body as {
      enabled?: boolean
      title?: string
      message?: string
    }

    // Upsert كل إعداد
    const updates = [
      { key: MAINTENANCE_ENABLED_KEY, value: enabled ? 'true' : 'false' },
      ...(title !== undefined ? [{ key: MAINTENANCE_TITLE_KEY, value: String(title) }] : []),
      ...(message !== undefined ? [{ key: MAINTENANCE_MESSAGE_KEY, value: String(message) }] : []),
    ]

    for (const update of updates) {
      await db.siteSetting.upsert({
        where: { key: `${MAINTENANCE_GROUP}_${update.key}` },
        create: {
          key: `${MAINTENANCE_GROUP}_${update.key}`,
          value: update.value,
          group: MAINTENANCE_GROUP,
        },
        update: { value: update.value },
      })
    }

    // إعادة القراءة بعد التحديث
    const settings = await getMaintenanceSettings()
    return ok({ settings, success: true })
  } catch (err) {
    console.error('[maintenance PUT] failed:', err)
    return internalError('Failed')
  }
}
