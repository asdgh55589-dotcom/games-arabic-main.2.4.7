import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireModerator()

    const { searchParams } = new URL(req.url)
    const range = searchParams.get('range') || '7d'

    const now = new Date()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const startDate = new Date(now.getTime() - days * 86400000)
    const prevStartDate = new Date(startDate.getTime() - days * 86400000)

    const [currentLogs, prevLogs] = await Promise.all([
      db.notificationLog.findMany({
        where: { createdAt: { gte: startDate } },
        select: { channel: true, status: true, createdAt: true, notification: { select: { type: true } } },
      }),
      db.notificationLog.findMany({
        where: { createdAt: { gte: prevStartDate, lt: startDate } },
        select: { status: true },
      }),
    ])

    const totalCreated = currentLogs.length
    const totalDelivered = currentLogs.filter((l) => l.status === 'sent').length
    const totalFailed = currentLogs.filter((l) => l.status === 'failed').length

    const prevTotal = prevLogs.length
    const prevDelivered = prevLogs.filter((l) => l.status === 'sent').length

    const growthRate = prevTotal > 0 ? ((totalCreated - prevTotal) / prevTotal) * 100 : 0
    const deliveryGrowth = prevDelivered > 0 ? ((totalDelivered - prevDelivered) / prevDelivered) * 100 : 0

    const byChannel: Record<string, number> = {}
    currentLogs.forEach((log) => {
      byChannel[log.channel] = (byChannel[log.channel] || 0) + 1
    })

    const byType: Record<string, number> = {}
    currentLogs.forEach((log) => {
      const type = (log.notification as unknown as { type: string } | null)?.type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    })

    const byDay: Record<string, { created: number; delivered: number; failed: number }> = {}
    currentLogs.forEach((log) => {
      const day = log.createdAt.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = { created: 0, delivered: 0, failed: 0 }
      byDay[day].created++
      if (log.status === 'sent') byDay[day].delivered++
      if (log.status === 'failed') byDay[day].failed++
    })

    const timeSeries = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }))

    return NextResponse.json({
      data: {
        range,
        totals: {
          created: totalCreated,
          delivered: totalDelivered,
          failed: totalFailed,
          deliveryRate: totalCreated > 0 ? (totalDelivered / totalCreated) * 100 : 0,
        },
        comparison: {
          prevTotal,
          growthRate,
          deliveryGrowth,
        },
        byChannel,
        byType,
        timeSeries,
      },
    })
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: (error as Error).message }, { status })
    }
    console.error('[admin/notifications/analytics] Error:', error)
    return NextResponse.json({ error: 'فشل تحميل التحليلات' }, { status: 500 })
  }
}
