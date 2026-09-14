import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/creator-requests — قائمة طلبات برنامج منشئ المحتوى (admin/manager/owner فقط)
// Query: status (pending|approved|rejected|all) + track + q (بحث بالاسم/البريد) + page + limit
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // pending | approved | rejected | all
    const track = searchParams.get('track') // publisher | translator | all
    const q = searchParams.get('q')?.trim() || ''
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }
    if (track && track !== 'all') {
      where.track = track
    }
    if (q) {
      where.user = {
        is: {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
      }
    }

    const [total, requests] = await Promise.all([
      db.creatorRequest.count({ where }),
      db.creatorRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              email: true,
              joinedAt: true,
              role: true,
              tier: true,
              specialRoles: true,
            },
          },
        },
      }),
    ])

    return ok({
      requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/creator-requests GET] failed:', err)
    return internalError('فشل جلب طلبات المُعَرِّبين')
  }
}
