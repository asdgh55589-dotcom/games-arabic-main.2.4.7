import { NextRequest } from 'next/server'
import { ok, validationFail, internalError } from '@/lib/api-response'
import { db } from '@/lib/db'
import { requireAdmin, requireModerator } from '@/lib/auth'
import { WORKFLOW_STATUSES, type WorkflowStatus } from '@/lib/workflow'

// PUT /api/admin/mods/bulk — تعديل جماعي
export async function PUT(req: NextRequest) {
  try {
    const user = await requireModerator()
    const body = await req.json()
    const { ids, action, value } = body as { ids: string[]; action: string; value: boolean | string }

    if (!Array.isArray(ids) || ids.length === 0) {
      return validationFail({ ids: 'ids required' })
    }

    if (action === 'workflowStatus') {
      // تغيير حالة العمل الجماعي
      const status = value as string
      if (!WORKFLOW_STATUSES.includes(status as WorkflowStatus)) {
        return validationFail({ value: 'Invalid workflow status' })
      }

      const updateData: Record<string, unknown> = { workflowStatus: status }
      if (status === 'PUBLISHED') updateData.publishedAt = new Date()
      if (status === 'ARCHIVED') updateData.archivedAt = new Date()

      await db.mod.updateMany({ where: { id: { in: ids } }, data: updateData })
      const affected = await db.mod.count({ where: { id: { in: ids } } })
      return ok({ success: true, updated: affected })
    }

    // للإجراءات الأخرى نحتاج صلاحيات admin
    await requireAdmin()

    const data: Record<string, boolean> = {}
    if (action === 'featured') data.isFeatured = Boolean(value)
    else if (action === 'trending') data.isTrending = Boolean(value)
    else if (action === 'latest') data.isLatest = Boolean(value)
    else return validationFail({ action: 'Invalid action' })

    await db.mod.updateMany({ where: { id: { in: ids } }, data })

    // Count actually affected records
    const affected = await db.mod.count({ where: { id: { in: ids } } })
    return ok({ success: true, updated: affected })
  } catch (err) {
    console.error('[admin/mods/bulk PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed')
  }
}

// DELETE /api/admin/mods/bulk — حذف جماعي
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids')
    if (!idsParam) return validationFail({ ids: 'ids required' })

    const ids = idsParam.split(',').filter(Boolean)
    if (ids.length === 0) return validationFail({ ids: 'ids required' })

    // Count before deleting
    const toDelete = await db.mod.count({ where: { id: { in: ids } } })
    await db.mod.deleteMany({ where: { id: { in: ids } } })

    return ok({ success: true, deleted: toDelete })
  } catch (err) {
    console.error('[admin/mods/bulk DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('Failed')
  }
}
