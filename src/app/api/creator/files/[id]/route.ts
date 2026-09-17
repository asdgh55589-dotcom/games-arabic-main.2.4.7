import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteUploadAsset } from '@/lib/file-delete'
import { reportError } from '@/lib/error-reporting'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/creator/files/[id] — تفاصيل ملف من ملفاتي + ارتباطاته
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return internalError('يجب تسجيل الدخول')

    const { id } = await params
    const asset = await db.uploadAsset.findUnique({ where: { id } })
    if (!asset || asset.userId !== user.id) {
      return notFound('الملف غير موجود — قد تم حذفه مسبقاً')
    }
    const [mod, links] = await Promise.all([
      asset.modId
        ? db.mod.findUnique({
            where: { id: asset.modId },
            select: { id: true, name: true, slug: true },
          })
        : Promise.resolve(null),
      db.modFileLink.findMany({
        where: { url: asset.originalUrl },
        select: {
          id: true,
          label: true,
          provider: true,
          file: { select: { id: true, title: true, modId: true } },
        },
      }),
    ])
    return ok({ ...asset, bytes: Number(asset.bytes), mod, linkedIn: links })
  } catch (err) {
    console.error('[creator/files/[id] GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/files/[id]' })
    return internalError('فشل جلب الملف')
  }
}

// DELETE /api/creator/files/[id] — حذف ملف من ملفاتي فقط
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return internalError('يجب تسجيل الدخول')

    const { id } = await params
    const asset = await db.uploadAsset.findUnique({ where: { id } })
    if (!asset) return notFound('الملف غير موجود — قد تم حذفه مسبقاً')
    if (asset.userId !== user.id) {
      return notFound('الملف غير موجود — قد تم حذفه مسبقاً')
    }

    const result = await deleteUploadAsset(asset, {
      id: user.id,
      username: user.username,
    })
    return ok({ ok: true, deleted: true, ...result })
  } catch (err) {
    console.error('[creator/files/[id] DELETE] failed:', err)
    reportError(err, { route: 'DELETE /api/creator/files/[id]' })
    return internalError('فشل حذف الملف — حاول مرة أخرى')
  }
}
