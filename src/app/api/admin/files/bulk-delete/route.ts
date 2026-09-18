import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { hasRoleAtLeast } from '@/lib/roles'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteUploadAsset } from '@/lib/file-delete'
import { reportError } from '@/lib/error-reporting'

// POST /api/admin/files/bulk-delete — حذف جماعي (حتى 50 ملف)
// مشرف: ملفاته فقط. admin+: أي ملفات.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return forbidden('يجب تسجيل الدخول')
    if (!hasRoleAtLeast(session.role, 'moderator')) {
      return forbidden('غير مصرح لك بحذف الملفات')
    }

    const body = await req.json().catch(() => null)
    const fileIds = Array.isArray(body?.fileIds)
      ? (body.fileIds as unknown[]).filter((v): v is string => typeof v === 'string' && v.length > 0)
      : []
    if (fileIds.length === 0) {
      return validationFail('أرسل مصفوفة fileIds غير فارغة')
    }
    if (fileIds.length > 50) {
      return validationFail('الحد الأقصى 50 ملفًا لكل طلب')
    }

    const isAdmin = hasRoleAtLeast(session.role, 'admin')
    let deleted = 0
    let failed = 0
    const errors: Array<{ id: string; reason: string }> = []

    for (const id of fileIds) {
      try {
        const asset = await db.uploadAsset.findUnique({ where: { id } })
        if (!asset) {
          failed += 1
          errors.push({ id, reason: 'الملف غير موجود' })
          continue
        }
        if (asset.userId !== session.id && !isAdmin) {
          failed += 1
          errors.push({ id, reason: 'يمكنك حذف ملفاتك فقط' })
          continue
        }
        await deleteUploadAsset(asset, { id: session.id, username: session.username })
        deleted += 1
      } catch (err) {
        failed += 1
        errors.push({ id, reason: err instanceof Error ? err.message : 'فشل الحذف' })
      }
    }

    try {
      await db.auditLog.create({
        data: {
          userId: session.id,
          username: session.username,
          action: 'delete',
          entity: 'file',
          details: JSON.stringify({ code: 'FILE_BULK_DELETED', deleted, failed, total: fileIds.length }),
        },
      })
    } catch {
      // best-effort audit
    }

    return ok({ ok: true, deleted, failed, errors })
  } catch (err) {
    console.error('[admin/files/bulk-delete] failed:', err)
    reportError(err, { route: 'POST /api/admin/files/bulk-delete' })
    return internalError('فشل الحذف الجماعي — حاول مرة أخرى')
  }
}
