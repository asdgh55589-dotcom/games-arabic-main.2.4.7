import type { NextRequest } from 'next/server'
import {
  badRequest,
  forbidden,
  internalError,
  ok,
  okPaginated,
  unauthorized,
} from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import * as auth from '@/lib/auth'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

const ALLOWED_TYPES = ['image', 'video', 'document', 'audio']
const MAX_SIZE = 50 * 1024 * 1024

function requireManagerFn() {
  return (auth as any).requireManager ?? (auth as any).requireAdmin
}

export async function GET(req: NextRequest) {
  try {
    await requireManagerFn()()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const tag = searchParams.get('tag')
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 24,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = { deletedAt: null }
    if (type) where.type = type
    if (tag) where.tags = { has: tag }

    const [total, items] = await Promise.all([
      db.mediaAsset.count({ where }),
      db.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return okPaginated(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح')
    logger.error({ err }, '[admin/media GET] failed')
    return internalError('Failed')
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireManagerFn()()
    const body = await req.json().catch(() => null)

    const url = body?.url
    if (typeof url !== 'string' || !url.trim()) {
      return badRequest('url is required')
    }
    const type = body?.type
    if (typeof type !== 'string' || !ALLOWED_TYPES.includes(type)) {
      return badRequest('invalid type')
    }

    const size = body?.size === undefined ? 0 : Number(body.size)
    if (!Number.isFinite(size) || size < 0 || size > MAX_SIZE) {
      return badRequest('size must be <= 50MB')
    }

    const tags = Array.isArray(body?.tags) ? body.tags.map((t: unknown) => String(t)) : []

    const asset = await db.mediaAsset.create({
      data: {
        url: url.trim(),
        type,
        mimeType: body?.mimeType != null ? String(body.mimeType) : null,
        size: Math.trunc(size),
        tags,
        uploadedBy: body?.uploadedBy != null ? String(body.uploadedBy) : (user?.id ?? null),
        metadata: body?.metadata ?? null,
      },
    })

    return ok(asset)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('سجّل الدخول أولاً')
    if (status === 403) return forbidden('غير مصرح')
    logger.error({ err }, '[admin/media POST] failed')
    return internalError('Failed')
  }
}
