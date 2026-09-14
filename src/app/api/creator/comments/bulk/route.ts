import type { NextRequest } from 'next/server'
import { forbidden, notFound, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { creatorBulkSetHidden } from '@/lib/comments/repository'
import { db } from '@/lib/db'

const MAX_BULK = 50

// POST /api/creator/comments/bulk — hide/unhide/delete many (all-or-nothing).
// Body: { ids: string[], action: 'hide' | 'unhide' | 'delete' }
export async function POST(req: NextRequest) {
  const { user, error } = await requireCreatorStudio(req)
  if (error) return error
  if (!user) return forbidden('يجب تسجيل الدخول')

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: unknown }
  const rawIds: unknown = body?.ids
  const ids: string[] = [
    ...new Set(
      (Array.isArray(rawIds) ? rawIds : []).filter((x): x is string => typeof x === 'string'),
    ),
  ]
  const action = typeof body?.action === 'string' ? body.action : ''

  if (ids.length === 0) return validationFail('اختر تعليقاً واحداً على الأقل')
  if (ids.length > MAX_BULK) return validationFail(`الحد الأقصى ${MAX_BULK} تعليقاً في العملية الواحدة`)
  if (!['hide', 'unhide', 'delete'].includes(action)) return validationFail('إجراء غير صالح')

  // Ownership FIRST: every id must sit on a mod authored by the caller
  // (admins may act on any mod). One query — no partial application.
  const isAdmin = ['admin', 'manager', 'owner'].includes(user.role)
  const rows = await db.modComment.findMany({
    where: { id: { in: ids } },
    select: { id: true, modId: true, mod: { select: { authorId: true } } },
  })
  if (rows.length !== ids.length) return notFound('بعض التعليقات غير موجودة')
  const foreign = rows.some((r) => r.mod.authorId !== user.id && !isAdmin)
  if (foreign) return forbidden('بعض التعليقات ليست على تعريباتك — لم يتم تنفيذ أي إجراء')

  if (action === 'delete') {
    const modIds = [...new Set(rows.map((r) => r.modId))]
    await db.$transaction(async (tx) => {
      await tx.modComment.deleteMany({ where: { id: { in: ids } } })
      for (const modId of modIds) {
        const count = await tx.modComment.count({ where: { modId } })
        await tx.mod.update({ where: { id: modId }, data: { comments: count } })
      }
    })
    return ok({ message: `تم حذف ${ids.length} تعليقات`, count: ids.length })
  }

  await creatorBulkSetHidden(ids, action === 'hide')
  return ok({
    message: action === 'hide' ? `تم إخفاء ${ids.length} تعليقات` : `تم إظهار ${ids.length} تعليقات`,
    count: ids.length,
  })
}
