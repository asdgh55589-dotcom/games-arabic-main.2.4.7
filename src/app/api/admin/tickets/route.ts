import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')
    const assignee = searchParams.get('assignee')
    const search = searchParams.get('q')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (status) where.status = status
    if (priority) where.priority = priority
    if (category) where.category = category
    if (assignee) where.assignedTo = assignee
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [tickets, total] = await Promise.all([
      db.ticket.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          assignedUser: { select: { id: true, username: true, avatarUrl: true } },
          tags: { select: { tag: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.ticket.count({ where }),
    ])

    const stats = await db.ticket.groupBy({
      by: ['status'],
      _count: { id: true },
    })

    const statusCounts = stats.reduce(
      (acc, s) => ({ ...acc, [s.status]: s._count.id }),
      {} as Record<string, number>
    )

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: statusCounts,
    })
  } catch (error) {
    console.error('[tickets GET]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireModerator()
    const body = await request.json()
    const { subject, description, category, priority, tags, assignedTo, userId } = body

    if (!subject || !description || !category || !userId) {
      return NextResponse.json(
        { error: 'العنوان والوصف والتصنيف ومعرف المستخدم مطلوبة' },
        { status: 400 }
      )
    }

    const ticket = await db.ticket.create({
      data: {
        subject,
        description,
        category,
        priority: priority || 'medium',
        userId,
        assignedTo: assignedTo || null,
        tags: tags?.length
          ? { create: tags.map((tag: string) => ({ tag })) }
          : undefined,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        assignedUser: { select: { id: true, username: true, avatarUrl: true } },
        tags: { select: { tag: true } },
      },
    })

    // Add initial message
    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        userId,
        content: description,
      },
    })

    await logAction({
      action: 'create_ticket',
      entity: 'ticket',
      entityId: ticket.id,
      details: JSON.stringify({ subject, category, priority }),
      request,
    })

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    console.error('[tickets POST]', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
