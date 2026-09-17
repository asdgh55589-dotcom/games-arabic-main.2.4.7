import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, okPaginated } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PaginationSchema } from '@/lib/schemas'

// GET /api/creator/team/mods — mods linked to the owned team.
// Owner-only. Search by name, paginated. Read-only; no rate limit.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const page = parsed.success ? parsed.data.page : 1
    const limit = Math.min(parsed.success ? parsed.data.limit : 20, 100)

    const where: Record<string, unknown> = { teamId: owned.id }
    if (q) (where as Record<string, unknown>).name = { contains: q, mode: 'insensitive' }

    const [total, mods] = await Promise.all([
      db.mod.count({ where }),
      db.mod.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          workflowStatus: true,
          downloads: true,
          rating: true,
          authorId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    return okPaginated(
      mods.map((m) => ({ ...m, isOwn: m.authorId === user.id })),
      { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    )
  } catch (err) {
    logger.error({ err }, '[creator/team/mods GET] failed')
    return internalError('فشل جلب تعريبات الفريق')
  }
}
