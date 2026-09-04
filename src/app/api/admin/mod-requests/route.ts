import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError, unauthorized, forbidden } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const search = searchParams.get('search')?.trim() || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10) || 25))

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') (where as Record<string, unknown>).status = status
    if (platform && platform !== 'all') (where as Record<string, unknown>).platform = platform
    if (search) {
      ;(where as Record<string, unknown>).OR = [
        { gameName: { contains: search, mode: 'insensitive' } },
        { platform: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      db.modRequest.count({ where }),
      db.modRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          mod: { select: { id: true, name: true, slug: true } },
          acceptedUser: { select: { id: true, username: true } },
        },
      }),
    ])

    return ok(
      {
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      } as never,
      undefined,
    )
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/mod-requests GET] failed:', err)
    return internalError('فشل جلب طلبات التعريب')
  }
}
