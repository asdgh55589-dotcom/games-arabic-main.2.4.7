import type { NextRequest } from 'next/server'
import {
  forbidden,
  internalError,
  notFound,
  ok,
  okPaginated,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

/** يحوّل خطأ صلاحيات إلى الاستجابة الصحيحة بدل 500 */
function authFail(err: unknown) {
  // duck-typing على status (يعمل مع AuthError ومع أي كائن خطأ يحمل status)
  const status = (err as { status?: number })?.status
  if (status === 401) return unauthorized('يجب تسجيل الدخول')
  if (status === 403) return forbidden('ليس لديك صلاحية')
  return null
}

// GET /api/admin/comments — جلب التعليقات (للإدارة)
export async function GET(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const page = Math.max(1, Number(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    const where = search
      ? {
          OR: [
            { text: { contains: search, mode: 'insensitive' as const } },
            { guestName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [comments, total] = await Promise.all([
      db.modComment.findMany({
        where,
        include: {
          mod: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      db.modComment.count({ where }),
    ])

    return okPaginated(comments, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[admin/comments GET] failed:', err)
    return authFail(err) ?? internalError('Failed')
  }
}

// DELETE /api/admin/comments — حذف تعليق
export async function DELETE(req: NextRequest) {
  try {
    await requireModerator()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return validationFail({ id: 'id required' })

    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, modId: true },
    })
    if (!comment) return notFound()

    // Wrap delete + count update in a transaction for atomicity
    await db.$transaction(async (tx) => {
      await tx.modComment.delete({ where: { id } })
      const count = await tx.modComment.count({ where: { modId: comment.modId } })
      await tx.mod.update({ where: { id: comment.modId }, data: { comments: count } })
    })

    return ok({ success: true })
  } catch (err) {
    console.error('[admin/comments DELETE] failed:', err)
    return authFail(err) ?? internalError('Failed')
  }
}
