import type { NextRequest } from 'next/server'
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
} from '@/lib/api-response'
import * as auth from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['image', 'video', 'document', 'audio']
const MAX_SIZE = 50 * 1024 * 1024

function managerFn() {
  return (auth as any).requireManager ?? (auth as any).requireAdmin
}
function adminFn() {
  return (auth as any).requireAdmin ?? (auth as any).requireManager
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await managerFn()()
    const { id } = await params

    const asset = await db.mediaAsset.findUnique({ where: { id } })
    if (!asset || asset.deletedAt) return notFound('Media asset not found')

    return ok(asset)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح')
    logger.error({ err }, '[admin/media/[id] GET] failed')
    return internalError('Failed')
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await managerFn()()
    const { id } = await params
    const body = await req.json().catch(() => null)

    const existing = await db.mediaAsset.findUnique({ where: { id } })
    if (!existing || existing.deletedAt) return notFound('Media asset not found')

    const data: Record<string, unknown> = {}

    if (body?.url !== undefined) {
      const url = typeof body.url === 'string' ? body.url.trim() : ''
      if (!url) return badRequest('url is required')
      data.url = url
    }
    if (body?.type !== undefined) {
      if (typeof body.type !== 'string' || !ALLOWED_TYPES.includes(body.type)) {
        return badRequest('invalid type')
      }
      data.type = body.type
    }
    if (body?.mimeType !== undefined) {
      data.mimeType = body.mimeType == null ? null : String(body.mimeType)
    }
    if (body?.size !== undefined) {
      const size = Number(body.size)
      if (!Number.isFinite(size) || size < 0 || size > MAX_SIZE) {
        return badRequest('size must be <= 50MB')
      }
      data.size = Math.trunc(size)
    }
    if (body?.tags !== undefined) {
      data.tags = Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)) : []
    }
    if (body?.metadata !== undefined) {
      data.metadata = body.metadata
    }
    if (body?.uploadedBy !== undefined) {
      data.uploadedBy = body.uploadedBy == null ? null : String(body.uploadedBy)
    }

    const updated = await db.mediaAsset.update({ where: { id }, data })
    return ok(updated)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح')
    logger.error({ err }, '[admin/media/[id] PATCH] failed')
    return internalError('Failed')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const hard = new URL(req.url).searchParams.get('hard') === '1'

    const user = await (hard ? adminFn() : managerFn())()
    if (hard) {
      const role = user?.role
      if (!role || !['admin', 'manager', 'owner'].includes(role)) {
        return forbidden('غير مصرح')
      }
    }

    const existing = await db.mediaAsset.findUnique({ where: { id } })
    if (!existing) return notFound('Media asset not found')

    if (hard) {
      await db.mediaAsset.delete({ where: { id } })
    } else {
      await db.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } })
    }

    return ok({ success: true })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح')
    logger.error({ err }, '[admin/media/[id] DELETE] failed')
    return internalError('Failed')
  }
}
