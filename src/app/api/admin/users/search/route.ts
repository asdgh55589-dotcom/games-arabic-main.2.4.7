import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const username = searchParams.get('username')?.trim() || ''
    const teamId = searchParams.get('teamId')

    if (q.length < 1 && username.length < 1) {
      return ok({ users: [] } as never)
    }

    const where: Record<string, unknown> = {}

    if (username) {
      ;(where as Record<string, unknown>).username = { equals: username, mode: 'insensitive' }
    } else if (q) {
      ;(where as Record<string, unknown>).OR = [{ username: { contains: q, mode: 'insensitive' } }]
    }

    if (teamId) {
      const existingLinks = await db.teamMembership.findMany({
        where: { teamId, userId: { not: null } },
        select: { userId: true },
      })
      const excludeIds = existingLinks.map((m) => m.userId).filter(Boolean) as string[]
      if (excludeIds.length > 0) {
        ;(where as Record<string, unknown>).id = { notIn: excludeIds }
      }
    }

    const users = await db.user.findMany({
      where: where as never,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        role: true,
        tier: true,
      },
      take: 10,
      orderBy: { username: 'asc' },
    })

    // Normalize avatar field for frontend (support both avatar and avatarUrl)
    const normalized = users.map((u) => ({
      ...u,
      avatar: (u as unknown as { avatarUrl: string | null }).avatarUrl,
    }))

    return ok({ users: normalized } as never)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden('ليس لديك صلاحية')
    console.error('[admin/users/search GET] failed:', err)
    return internalError('فشل البحث عن المستخدمين')
  }
}
