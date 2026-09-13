import type { NextRequest } from 'next/server'
import { internalError, ok, unauthorized, forbidden, validationFail } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { hasRoleAtLeast } from '@/lib/roles'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized('يجب تسجيل الدخول')

    const body = await req.json().catch(() => ({}))
    const { id, url } = body as { id?: string; url?: string }

    if (!id && !url) {
      return validationFail('يجب إرسال id أو url للحذف')
    }

    const asset = id
      ? await db.uploadAsset.findUnique({ where: { id } })
      : await db.uploadAsset.findFirst({ where: { originalUrl: url! } })

    if (!asset) {
      return ok({ ok: true, deleted: false, message: 'الملف غير موجود — قد تم حذفه مسبقاً' })
    }

    // Owner or mod-author only
    const isOwner = asset.userId === session.id
    const isMod = hasRoleAtLeast(session.role, 'moderator')
    if (!isOwner && !isMod) {
      return forbidden('غير مصرح لك بحذف هذا الملف')
    }

    // Best-effort FreeImage delete via deleteUrl (swallow 404)
    if (asset.storageKey) {
      try {
        const res = await fetch(asset.storageKey, { method: 'DELETE', signal: AbortSignal.timeout(10_000) })
        if (res.status !== 404) {
          logger.info({ status: res.status, assetId: asset.id }, 'FreeImage delete response')
        }
      } catch (err) {
        logger.warn({ err, assetId: asset.id }, 'FreeImage delete failed (best-effort)')
      }
    }

    // Mark UploadAsset deleted + clear wrappedUrl
    await db.uploadAsset.update({
      where: { id: asset.id },
      data: { wrappedUrl: null, storageKey: null },
    })

    return ok({ ok: true, deleted: true })
  } catch (error) {
    console.error('[delete-image] failed:', error)
    logger.error({ err: error }, 'delete-image route failed')
    const message = error instanceof Error ? error.message : 'فشل حذف الصورة — حاول مرة أخرى'
    return internalError(message)
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req)
}
