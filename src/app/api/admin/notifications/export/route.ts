import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const channel = searchParams.get('channel')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (channel) (where as Record<string, unknown>).channel = channel
    if (status) (where as Record<string, unknown>).status = status

    const logs = await db.notificationLog.findMany({
      where,
      include: {
        notification: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })

    const headers = ['التاريخ', 'النوع', 'العنوان', 'المستلم', 'القناة', 'الحالة']

    const rows = logs.map((log) => [
      new Date(log.createdAt).toISOString(),
      (NOTIFICATION_TYPE_LABELS as Record<string, string>)[(log.notification as unknown as { type: string })?.type] || (log.notification as unknown as { type: string })?.type || '',
      (log.notification as unknown as { title: string })?.title || '',
      (log.notification as unknown as { user: { username: string } })?.user?.username || '',
      log.channel,
      log.status,
    ])

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')

    const bom = '\uFEFF'

    return new NextResponse(bom + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="notifications-export.csv"',
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: (error as Error).message }, { status })
    }
    console.error('[admin/notifications/export] Error:', error)
    return NextResponse.json({ error: 'فشل التصدير' }, { status: 500 })
  }
}
