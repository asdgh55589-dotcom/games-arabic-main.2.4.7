import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const messages = await db.ticketMessage.findMany({
      where: { ticketId: id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(messages)
  } catch (error) {
    console.error('[ticket-messages GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await request.json()
    const { content, isInternal, userId, newStatus } = body

    if (!content || !userId) {
      return NextResponse.json(
        { error: 'المحتوى ومعرف المستخدم مطلوبان' },
        { status: 400 }
      )
    }

    const message = await db.ticketMessage.create({
      data: {
        ticketId: id,
        userId,
        content,
        isInternal: isInternal || false,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    })

    // Update ticket timestamp and optionally status
    const updateData: any = { updatedAt: new Date() }
    if (newStatus) {
      updateData.status = newStatus
      if (newStatus === 'resolved') updateData.resolvedAt = new Date()
      if (newStatus === 'closed') updateData.closedAt = new Date()
    }
    await db.ticket.update({ where: { id }, data: updateData })

    await logAction({
      action: 'add_ticket_message',
      entity: 'ticket',
      entityId: id,
      details: JSON.stringify({ isInternal: isInternal || false }),
      request,
    })

    return NextResponse.json(message, { status: 201 })
  } catch (error) {
    console.error('[ticket-messages POST]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      return NextResponse.json(
        { error: 'معرف الرسالة مطلوب' },
        { status: 400 }
      )
    }

    await db.ticketMessage.delete({ where: { id: messageId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ticket-messages DELETE]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
