import type { NextRequest } from 'next/server'
import {
  forbidden,
  internalError,
  notFound,
  ok,
  unauthorized,
  validationFail,
} from '@/lib/api-response'
import { getOptionalSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { UpdateCommentSchema } from '@/lib/schemas'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/comments/[id] — تعديل التعليق (صاحب التعليق فقط)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!comment) {
      return notFound('Comment not found')
    }

    if (comment.userId !== user.id) {
      return forbidden()
    }

    const body = await req.json()
    const parsed = UpdateCommentSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { text } = parsed.data

    const updated = await db.modComment.update({
      where: { id },
      data: { text: text.trim(), isEdited: true },
      select: { id: true, text: true, isEdited: true, updatedAt: true },
    })

    return ok(updated)
  } catch (err) {
    console.error('[comment PATCH] failed:', err)
    return internalError('Failed to update comment')
  }
}

// DELETE /api/comments/[id] — حذف التعليق (صاحب التعليق أو الأدمن)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getOptionalSession()
    if (!user) {
      return unauthorized()
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, userId: true, modId: true },
    })

    if (!comment) {
      return notFound('Comment not found')
    }

    const isOwner = comment.userId === user.id
    const isAdmin = ['owner', 'admin', 'moderator'].includes(user.role)

    if (!isOwner && !isAdmin) {
      return forbidden()
    }

    // جمع الأحفاد بمستويات محدودة (مفهرسة على parentId) بدل مسح جدول المود كاملاً.
    // العمق الأقصى 5 + هامش أمان → 10 جولات كحد أقصى.
    const idsToDelete = [id]
    let frontier = [id]
    for (let level = 0; level < 10 && frontier.length > 0; level++) {
      const children = await db.modComment.findMany({
        where: { modId: comment.modId, parentId: { in: frontier } },
        select: { id: true },
      })
      if (children.length === 0) break
      const childIds = children.map((c) => c.id)
      idsToDelete.push(...childIds)
      frontier = childIds
    }
    const totalToDelete = idsToDelete.length

    await db.$transaction([
      db.modComment.deleteMany({ where: { id: { in: idsToDelete } } }),
      db.mod.update({
        where: { id: comment.modId },
        data: { comments: { decrement: totalToDelete } },
      }),
    ])

    return ok({ success: true, deletedCount: totalToDelete })
  } catch (err) {
    console.error('[comment DELETE] failed:', err)
    return internalError('Failed to delete comment')
  }
}
