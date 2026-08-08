import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwner, requireModerator } from '@/lib/auth'

// GET /api/admin/settings — قراءة الإعدادات
export async function GET() {
  try {
    await requireModerator()
    const settings = await db.siteSetting.findMany()
    const grouped: Record<string, Record<string, string>> = {}
    for (const s of settings) {
      if (!grouped[s.group]) grouped[s.group] = {}
      grouped[s.group][s.key] = s.value
    }
    return NextResponse.json({ settings: grouped })
  } catch (err) {
    console.error('[admin/settings GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// PUT /api/admin/settings — تحديث الإعدادات
export async function PUT(req: NextRequest) {
  try {
    await requireOwner()
    const body = await req.json()
    const { settings } = body as { settings: Record<string, Record<string, string>> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/settings PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
