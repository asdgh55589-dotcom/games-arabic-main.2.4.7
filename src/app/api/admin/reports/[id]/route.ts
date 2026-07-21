import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const report = await db.report.findUnique({
      where: { id },
      select: {
        id: true,
        targetType: true,
        reason: true,
        priority: true,
        status: true,
        description: true,
        evidenceUrls: true,
        actionTaken: true,
        actionAt: true,
        resolution: true,
        resolvedAt: true,
        ipAddress: true,
        createdAt: true,
        reporter: { select: { id: true, username: true, avatarUrl: true, role: true } },
        targetMod: { select: { id: true, name: true, slug: true, thumbnailUrl: true } },
        targetComment: { select: { id: true, text: true, createdAt: true } },
        targetUser: { select: { id: true, username: true, avatarUrl: true, role: true } },
        assignedTo: { select: { id: true, username: true, avatarUrl: true } },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    let previousReports = 0
    if (report.targetMod) {
      previousReports = await db.report.count({
        where: { targetModId: report.targetMod.id, id: { not: id } },
      })
    } else if (report.targetComment) {
      previousReports = await db.report.count({
        where: { targetCommentId: report.targetComment.id, id: { not: id } },
      })
    } else if (report.targetUser) {
      previousReports = await db.report.count({
        where: { targetUserId: report.targetUser.id, id: { not: id } },
      })
    }

    return NextResponse.json({ report: { ...report, previousReports } })
  } catch (err) {
    console.error('[admin/reports/[id] GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const report = await db.report.findUnique({ where: { id }, select: { id: true } })
    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.resolution !== undefined) updateData.resolution = body.resolution

    await db.report.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/reports/[id] PATCH] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
