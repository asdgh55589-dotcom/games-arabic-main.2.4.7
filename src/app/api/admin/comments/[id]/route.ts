import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

// PUT /api/admin/comments/[id] — تثبيت/إلغاء تثبيت تعليق
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const comment = await db.modComment.findUnique({ where: { id } })
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updated = await db.modComment.update({
      where: { id },
      data: {
        isPinned: body.isPinned !== undefined ? Boolean(body.isPinned) : comment.isPinned,
      },
    })

    return NextResponse.json({ comment: updated })
  } catch (err) {
    console.error('[admin/comments/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/comments/[id] — حذف تعليق واحد
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params

    const comment = await db.modComment.findUnique({ where: { id }, select: { id: true, modId: true } })
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Wrap delete + count update in a transaction for atomicity
    await db.$transaction(async (tx) => {
      await tx.modComment.delete({ where: { id } })
      const count = await tx.modComment.count({ where: { modId: comment.modId } })
      await tx.mod.update({ where: { id: comment.modId }, data: { comments: count } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/comments/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
