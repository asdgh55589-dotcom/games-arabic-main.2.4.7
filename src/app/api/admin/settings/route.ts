import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireManager, requireModerator } from '@/lib/auth'
import { ok, internalError, validationFail } from '@/lib/api-response'

// GET /api/admin/settings — قراءة الإعدادات
export async function GET() {
  try {
    await requireModerator()
    const settings = await db.siteSetting.findMany({ take: 200 })
    const grouped: Record<string, Record<string, string>> = {}
    for (const s of settings) {
      if (!grouped[s.group]) grouped[s.group] = {}
      grouped[s.group][s.key] = s.value
    }
    return ok({ settings: grouped })
  } catch (err) {
    console.error('[admin/settings GET] failed:', err)
    return internalError('Failed')
  }
}

// PUT /api/admin/settings — تحديث الإعدادات (manager+ فقط)
export async function PUT(req: NextRequest) {
  try {
    await requireManager()
    const body = await req.json()
    const { settings } = body as { settings: Record<string, Record<string, string>> }

    if (!settings || typeof settings !== 'object') {
      return validationFail({ error: 'Invalid data' })
    }

    //Upsert كل إعداد
    for (const [group, entries] of Object.entries(settings)) {
      for (const [key, value] of Object.entries(entries)) {
        await db.siteSetting.upsert({
          where: { key },
          create: { key, value: String(value), group },
          update: { value: String(value), group },
        })
      }
    }

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/settings PUT] failed:', err)
    return internalError('Failed')
  }
}
