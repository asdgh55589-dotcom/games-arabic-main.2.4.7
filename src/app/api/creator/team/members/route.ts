import type { NextRequest } from 'next/server'
import { forbidden, internalError, notFound, okPaginated } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { getOwnedTeam } from '@/lib/creator-team'
import { db } from '@/lib/db'
import { PaginationSchema } from '@/lib/schemas'

// GET /api/creator/team/members — read-only member list for the owned team.
export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  try {
    const owned = await getOwnedTeam(user.id)
    if (!owned) return notFound('لا يوجد فريق بعد — أنشئ فريقك الأول')

    const { searchParams } = new URL(req.url)
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    })
    const page = parsed.success ? parsed.data.page : 1
    const limit = Math.min(parsed.success ? parsed.data.limit : 24, 100)

    const [total, rows] = await Promise.all([
      db.teamMembership.count({ where: { teamId: owned.id } }),
      db.teamMembership.findMany({
        where: { teamId: owned.id },
        orderBy: { joinedAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      }),
    ])

    const members = rows.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user?.displayName || m.user?.username || m.name,
      username: m.user?.username ?? null,
      avatarUrl: m.user?.avatarUrl ?? m.avatarUrl,
      role: m.role,
      isLinked: Boolean(m.userId),
      joinedAt: m.joinedAt,
    }))

    return okPaginated(members, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    })
  } catch (err) {
    console.error('[creator/team/members GET] failed:', err)
    return internalError('فشل جلب أعضاء الفريق')
  }
}
