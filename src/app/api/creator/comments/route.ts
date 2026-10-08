import type { NextRequest } from 'next/server'
import { ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { creatorListComments } from '@/lib/comments/repository'

// B5 — explicit filter whitelist: unknown values must not silently
// widen the query to `all`.
const FILTERS = ['all', 'visible', 'hidden'] as const

export async function GET(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return error!

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

  const filter = searchParams.get('filter') || 'all' // all | visible | hidden
  if (!(FILTERS as readonly string[]).includes(filter)) {
    return validationFail('الفلتر غير صالح')
  }

  const { comments, total } = await creatorListComments(user.id, { filter, page, limit })

  return ok({
    comments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  })
}
