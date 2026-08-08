import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

// POST /api/admin/teams/[id]/members — إضافة عضو
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'اسم العضو مطلوب' }, { status: 400 })
    }

    const team = await db.team.findUnique({ where: { id } })
    if (!team) {
      return NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 })
    }

    const member = await db.teamMembership.create({
      data: {
        teamId: id,
        userId: body.userId || null,
        name: body.name.trim(),
        avatarUrl: body.avatarUrl || null,
        role: body.role || 'member',
        bio: body.bio || null,
      },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (err) {
    console.error('[admin/teams/[id]/members POST] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/teams/[id]/members — حذف عضو
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireModerator()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId مطلوب' }, { status: 400 })
    }

    await db.teamMembership.deleteMany({
      where: { id: memberId, teamId: id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/teams/[id]/members DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
