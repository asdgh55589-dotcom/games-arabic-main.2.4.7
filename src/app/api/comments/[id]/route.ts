import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  return db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true, role: true },
  })
}

// PATCH /api/comments/[id] — تعديل التعليق (صاحب التعليق فقط)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (comment.userId !== currentUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const text = body.text?.trim()
    if (!text || text.length < 1) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'Text too long' }, { status: 400 })
    }

    const updated = await db.modComment.update({
      where: { id },
      data: { text, isEdited: true },
      select: { id: true, text: true, isEdited: true, updatedAt: true },
    })

    return NextResponse.json({ comment: updated })
  } catch (err) {
    console.error('[comment PATCH] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// DELETE /api/comments/[id] — حذف التعليق (صاحب التعليق أو الأدمن)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const currentUser = await requireUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const comment = await db.modComment.findUnique({
      where: { id },
      select: { id: true, userId: true, modId: true },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const isOwner = comment.userId === currentUser.id
    const isAdmin = ['owner', 'admin', 'moderator'].includes(currentUser.role)

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await db.$transaction([
      db.modComment.delete({ where: { id } }),
      db.mod.update({
        where: { id: comment.modId },
        data: { comments: { decrement: 1 } },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[comment DELETE] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
