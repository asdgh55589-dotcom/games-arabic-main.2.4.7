import type { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

export async function GET(_req: NextRequest) {
  try {
    await requireModerator()

    const moderators = await db.user.findMany({
      where: { role: { in: ['moderator', 'manager', 'admin', 'owner'] } },
      select: {
        id: true,
        username: true,
        role: true,
        reportsAssigned: {
          where: { status: { in: ['new', 'under_review', 'pending'] } },
          select: { id: true },
        },
      },
      orderBy: { username: 'asc' },
    })

    const result = moderators.map((m) => ({
      id: m.id,
      username: m.username,
      role: m.role,
      workload: m.reportsAssigned.length,
    }))

    return ok(result)
  } catch (error) {
    console.error('[Assignable] Failed:', error)
    return internalError('فشل تحميل قائمة المشرفين')
  }
}
