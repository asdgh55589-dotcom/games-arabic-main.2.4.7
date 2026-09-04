import { type NextRequest, NextResponse } from 'next/server'
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
        select: {
          channel: true,
          status: true,
          createdAt: true,
          notification: { select: { type: true } },
        },
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
    const deliveryGrowth =
      prevDelivered > 0 ? ((totalDelivered - prevDelivered) / prevDelivered) * 100 : 0

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

    const emailLogs = currentLogs.filter((l) => l.channel === 'email')
    // نحتاج openedAt/clickedAt/deliveredAt — نجلبه من DB إذا لم يكن في select أعلاه
    // نعيد الجلب مع الحقول الجديدة للتوافق
    let emailStats = { sent: 0, delivered: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 }
    if (emailLogs.length > 0 || true) {
      const emailDetailedLogs = await db.notificationLog.findMany({
        where: { channel: 'email', createdAt: { gte: startDate } },
        select: { deliveredAt: true, openedAt: true, clickedAt: true },
      })
      const sent = emailDetailedLogs.length
      const delivered = emailDetailedLogs.filter((l) => l.deliveredAt).length
      const opened = emailDetailedLogs.filter((l) => l.openedAt).length
      const clicked = emailDetailedLogs.filter((l) => l.clickedAt).length
      emailStats = {
        sent,
        delivered,
        opened,
        clicked,
        openRate: sent > 0 ? (opened / sent) * 100 : 0,
        clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
      }
    }

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
        emailStats,
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
