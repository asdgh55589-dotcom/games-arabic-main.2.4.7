import type { NextRequest } from 'next/server'
import { internalError, ok, okPaginated } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'

// GET /api/admin/video-cache — قائمة الفيديوهات المخزنة (50/page)
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || null
    const provider = searchParams.get('provider')?.trim() || null
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 50,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = {}
    if (provider === 'youtube' || provider === 'vimeo') where.provider = provider
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { url: { contains: search } },
        { channel: { contains: search } },
      ]
    }

    const [total, rows] = await Promise.all([
      db.videoMetadataCache.count({ where }),
      db.videoMetadataCache.findMany({
        where,
        orderBy: { fetchedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const now = Date.now()
    const data = rows.map((r) => ({
      ...r,
      stale: now - r.fetchedAt.getTime() > 24 * 60 * 60 * 1000,
    }))

    return okPaginated(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[admin/video-cache GET] failed:', err)
    reportError(err, { route: 'GET /api/admin/video-cache' })
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) return internalError('Unauthorized or forbidden')
    return internalError('فشل جلب الكاش')
  }
}

// DELETE /api/admin/video-cache — مسح الكاش (كله أو روابط محددة، للإدارة)
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireModerator()
    if (!['admin', 'manager', 'owner'].includes(user.role)) {
      const { forbidden } = await import('@/lib/api-response')
      return forbidden('هذه العملية متاحة للمسؤولين فقط')
    }
    const body = await req.json().catch(() => null)
    const urls = Array.isArray(body?.urls)
      ? (body.urls as unknown[]).filter((u): u is string => typeof u === 'string').slice(0, 200)
      : null

    const deleted = urls
      ? await db.videoMetadataCache.deleteMany({ where: { url: { in: urls } } })
      : await db.videoMetadataCache.deleteMany({})

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          username: user.username,
          action: 'delete',
          entity: 'video-cache',
          details: JSON.stringify({ code: 'VIDEO_CACHE_CLEARED', count: deleted.count, scoped: Boolean(urls) }),
        },
      })
    } catch {
      // best-effort audit
    }

    return ok({ ok: true, cleared: deleted.count })
  } catch (err) {
    console.error('[admin/video-cache DELETE] failed:', err)
    reportError(err, { route: 'DELETE /api/admin/video-cache' })
    return internalError('فشل مسح الكاش')
  }
}
