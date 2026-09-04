import type { NextRequest } from 'next/server'
import { fail, internalError, ok } from '@/lib/api-response'
import { requireOwner } from '@/lib/auth'
import {
  cleanupOldBackups,
  createDatabaseBackup,
  deleteBackup,
  getTotalBackupSize,
  listBackups,
} from '@/lib/backup'

// GET /api/admin/backup — قائمة النسخ الاحتياطية
export async function GET() {
  try {
    await requireOwner()

    const backups = listBackups()
    const totalSize = getTotalBackupSize()

    return ok({
      backups,
      totalSize,
      totalBackups: backups.length,
      lastBackup: backups[0] || null,
    })
  } catch (err) {
    console.error('[admin/backup] GET failed:', err)
    return internalError('فشل في تحميل النسخ الاحتياطية')
  }
}

// POST /api/admin/backup — إنشاء نسخة احتياطية
export async function POST(req: NextRequest) {
  try {
    await requireOwner()

    const body = await req.json().catch(() => ({}))

    const backup = await createDatabaseBackup()

    // Cleanup old backups if requested
    if (body.cleanup) {
      await cleanupOldBackups()
    }

    return ok(backup)
  } catch (err) {
    console.error('[admin/backup] POST failed:', err)
    return internalError('فشل في إنشاء النسخة الاحتياطية')
  }
}

// DELETE /api/admin/backup — حذف نسخة احتياطية
export async function DELETE(req: NextRequest) {
  try {
    await requireOwner()

    const url = req.nextUrl
    const filename = url.searchParams.get('filename')

    if (!filename) {
      return fail('VALIDATION_ERROR', 'اسم الملف مطلوب', 422)
    }

    const deleted = deleteBackup(filename)
    if (!deleted) {
      return fail('NOT_FOUND', 'الملف غير موجود', 404)
    }

    return ok({ deleted: true })
  } catch (err) {
    console.error('[admin/backup] DELETE failed:', err)
    return internalError('فشل في حذف النسخة الاحتياطية')
  }
}
