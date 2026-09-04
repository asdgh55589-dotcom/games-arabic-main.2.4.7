import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const ticket = await db.ticket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        assignedUser: { select: { id: true, username: true, avatarUrl: true } },
        tags: { select: { tag: true } },
        messages: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'التذكرة غير موجودة' }, { status: 404 })
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('[ticket GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await request.json()
    const { status, priority, assignedTo, subject, description } = body

    const updateData: any = {}
    if (status) {
      updateData.status = status
      if (status === 'resolved') updateData.resolvedAt = new Date()
      if (status === 'closed') updateData.closedAt = new Date()
    }
    if (priority) updateData.priority = priority
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo
    if (subject) updateData.subject = subject
    if (description) updateData.description = description

    const ticket = await db.ticket.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        assignedUser: { select: { id: true, username: true, avatarUrl: true } },
        tags: { select: { tag: true } },
      },
    })

    await logAction({
      action: 'update_ticket',
      entity: 'ticket',
      entityId: id,
      details: JSON.stringify(updateData),
      request,
    })

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('[ticket PATCH]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params

    await db.ticketMessage.deleteMany({ where: { ticketId: id } })
    await db.ticketTag.deleteMany({ where: { ticketId: id } })
    await db.ticket.delete({ where: { id } })

    await logAction({
      action: 'delete_ticket',
      entity: 'ticket',
      entityId: id,
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ticket DELETE]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
