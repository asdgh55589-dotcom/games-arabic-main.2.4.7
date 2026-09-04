import type { NextRequest } from 'next/server'
import { internalError, notFound, ok } from '@/lib/api-response'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requireModerator()
    const { id } = await params

    const report = await db.report.findUnique({ where: { id }, select: { id: true } })
    if (!report) {
      return notFound('البلاغ غير موجود')
    }

    const history = await db.reportStatusHistory.findMany({
      where: { reportId: id },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return ok(history)
  } catch (err) {
    console.error('[admin/reports/[id]/history GET] failed:', err)
    return internalError('Failed')
  }
}
