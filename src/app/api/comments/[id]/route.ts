import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import {
  ok,
  unauthorized,
  notFound,
  forbidden,
  validationFail,
  internalError,
} from '@/lib/api-response'
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

    // Count total descendants to fix counter drift (cascade deletes)
    const allModComments = await db.modComment.findMany({
      where: { modId: comment.modId },
      select: { id: true, parentId: true },
    })
    const childMap = new Map<string, string[]>()
    for (const c of allModComments) {
      if (c.parentId) {
        const arr = childMap.get(c.parentId) || []
        arr.push(c.id)
        childMap.set(c.parentId, arr)
      }
    }
    const descendantIds: string[] = []
    const queue: string[] = [id]
    while (queue.length > 0) {
      const current = queue.shift()!
      const children = childMap.get(current) || []
      for (const childId of children) {
        descendantIds.push(childId)
        queue.push(childId)
      }
    }
    const totalToDelete = 1 + descendantIds.length
    const idsToDelete = [id, ...descendantIds]

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
