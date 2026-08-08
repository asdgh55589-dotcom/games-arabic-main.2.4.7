import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// PUT /api/admin/mods/bulk — تعديل جماعي
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { ids, action, value } = body as { ids: string[]; action: string; value: boolean }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids required' }, { status: 400 })
    }

    const data: Record<string, boolean> = {}
    if (action === 'featured') data.isFeatured = Boolean(value)
    else if (action === 'trending') data.isTrending = Boolean(value)
    else if (action === 'latest') data.isLatest = Boolean(value)
    else return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

    await db.mod.updateMany({ where: { id: { in: ids } }, data })

    // Count actually affected records
    const affected = await db.mod.count({ where: { id: { in: ids } } })
    return NextResponse.json({ success: true, updated: affected })
  } catch (err) {
    console.error('[admin/mods/bulk PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/mods/bulk — حذف جماعي
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam) return NextResponse.json({ error: 'ids required' }, { status: 400 })

    const ids = idsParam.split(',').filter(Boolean)
    if (ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })

    // Count before deleting
    const toDelete = await db.mod.count({ where: { id: { in: ids } } })
    await db.mod.deleteMany({ where: { id: { in: ids } } })

    return NextResponse.json({ success: true, deleted: toDelete })
  } catch (err) {
    console.error('[admin/mods/bulk DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
