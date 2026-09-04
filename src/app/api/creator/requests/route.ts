import type { NextRequest } from 'next/server'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || 'all'

  const where: Record<string, unknown> = {}
  if (status === 'all') {
    // no filter — show all
  } else if (status === 'mine') {
    ;(where as Record<string, unknown>).acceptedBy = user.id
  } else {
    ;(where as Record<string, unknown>).status = status
  }

  const requests = await db.modRequest.findMany({
    where: where as never,
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
      mod: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ interestCount: 'desc' }, { createdAt: 'desc' }],
  })

  return ok({ requests })
}
