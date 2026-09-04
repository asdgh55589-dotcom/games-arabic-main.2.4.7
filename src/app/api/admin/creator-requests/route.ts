import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ok, unauthorized, forbidden, internalError } from '@/lib/api-response'

// GET /api/admin/creator-requests — قائمة طلبات المُعَرِّبين (admin/manager/owner فقط)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // pending | approved | rejected | all

    const where: Record<string, unknown> = {}
    if (status && status !== 'all') {
      where.status = status
    }

    const requests = await db.creatorRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
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
    })

    // Sort: pending first, then approved, then rejected, then by date
    const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 }
    requests.sort((a, b) => {
      const ao = order[a.status] ?? 99
      const bo = order[b.status] ?? 99
      if (ao !== bo) return ao - bo
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return ok({ requests })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/creator-requests GET] failed:', err)
    return internalError('فشل جلب طلبات المُعَرِّبين')
  }
}
