import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, ok } from '@/lib/api-response'
import { hasRoleAtLeast } from '@/lib/roles'
import { getSession, requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteUploadAsset } from '@/lib/file-delete'
import { reportError } from '@/lib/error-reporting'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getAssetWithJoins(id: string) {
  const asset = await db.uploadAsset.findUnique({ where: { id } })
  if (!asset) return null
  const [user, mod, links] = await Promise.all([
    db.user.findUnique({
      where: { id: asset.userId },
      select: { id: true, username: true, avatarUrl: true, role: true },
    }),
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
  return { ...asset, bytes: Number(asset.bytes), user, mod, linkedIn: links }
}

// GET /api/admin/files/[id] — تفاصيل ملف واحد + المودات المرتبطة به
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const asset = await getAssetWithJoins(id)
    if (!asset) return notFound('الملف غير موجود')
    return ok(asset)
  } catch (err) {
    console.error('[admin/files/[id] GET] failed:', err)
    reportError(err, { route: 'GET /api/admin/files/[id]' })
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return internalError('Unauthorized or forbidden')
    }
    return internalError('فشل جلب الملف')
  }
}

// DELETE /api/admin/files/[id] — حذف ملف (إدارة: أي ملف، مشرف: ملفاته فقط)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session) return forbidden('يجب تسجيل الدخول')
    if (!hasRoleAtLeast(session.role, 'moderator')) {
      return forbidden('غير مصرح لك بحذف الملفات')
    }
    const { id } = await params
    const asset = await db.uploadAsset.findUnique({ where: { id } })
    if (!asset) return notFound('الملف غير موجود — قد تم حذفه مسبقاً')

    // Moderators delete own files only; admin+ deletes any.
    const isOwner = asset.userId === session.id
    if (!isOwner && !hasRoleAtLeast(session.role, 'admin')) {
      return forbidden('يمكنك حذف ملفاتك فقط')
    }

    const result = await deleteUploadAsset(asset, {
      id: session.id,
      username: session.username,
    })
    return ok({ ok: true, deleted: true, ...result })
  } catch (err) {
    console.error('[admin/files/[id] DELETE] failed:', err)
    reportError(err, { route: 'DELETE /api/admin/files/[id]' })
    return internalError('فشل حذف الملف — حاول مرة أخرى')
  }
}
