import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'

export async function GET() {
  try {
    await requireModerator()

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    const [total, newCount, underReview, confirmed, rejected, resolved] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: 'new' } }),
      db.report.count({ where: { status: 'under_review' } }),
      db.report.count({ where: { status: 'confirmed' } }),
      db.report.count({ where: { status: 'rejected' } }),
      db.report.count({ where: { status: 'resolved' } }),
    ])

    const confirmationRate = (confirmed + rejected) > 0 ? confirmed / (confirmed + rejected) : 0

    const resolvedReports = await db.report.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      take: 100,
    })
    const avgResolutionHours = resolvedReports.length > 0
      ? resolvedReports.reduce((sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolvedReports.length / (1000 * 60 * 60)
      : 0

    const reasonGroups = await db.report.groupBy({
      by: ['reason'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const topReasons = reasonGroups.map(g => ({ reason: g.reason, count: g._count.id }))

    const reporterGroups = await db.report.groupBy({
      by: ['reporterId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
      where: { reporterId: { not: null } },
    })
    const topReporters = reporterGroups.map(g => ({ userId: g.reporterId!, count: g._count.id }))

    const dailyReports = await db.report.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    })
    const dailyMap = new Map<string, number>()
    for (const r of dailyReports) {
      const key = r.createdAt.toISOString().split('T')[0]
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1)
    }
    const dailyTrend = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))

    const weeklyReports = await db.report.findMany({
      where: { createdAt: { gte: twelveWeeksAgo } },
      select: { createdAt: true },
    })
    const weeklyMap = new Map<string, number>()
    for (const r of weeklyReports) {
      const d = r.createdAt
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      const key = weekStart.toISOString().split('T')[0]
      weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1)
    }
    const weeklyTrend = Array.from(weeklyMap.entries()).map(([week, count]) => ({ week, count })).sort((a, b) => a.week.localeCompare(b.week))

    const monthlyReports = await db.report.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    })
    const monthlyMap = new Map<string, number>()
    for (const r of monthlyReports) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1)
    }
    const monthlyTrend = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month))

    const actionGroups = await db.report.groupBy({
      by: ['actionTaken'],
      _count: { id: true },
      where: { actionTaken: { not: null } },
    })
    const actionsTaken = actionGroups.map(g => ({ action: g.actionTaken!, count: g._count.id }))

    const bannedUsers = await db.user.count({ where: { banStatus: { in: ['banned_temp', 'banned_perm'] } } })
    const warnedUsers = await db.userAction.count({ where: { action: 'warn' } })

    const repeatOffenderGroups = await db.report.groupBy({
      by: ['targetUserId'],
      _count: { id: true },
      where: { targetUserId: { not: null }, status: 'confirmed' },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    })
    const repeatOffenders = repeatOffenderGroups.map(g => ({ userId: g.targetUserId!, reportsReceived: g._count.id }))

    return NextResponse.json({
      total, new: newCount, underReview, confirmed, rejected, resolved,
      confirmationRate: Math.round(confirmationRate * 100) / 100,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      topReasons, topReporters, dailyTrend, weeklyTrend, monthlyTrend,
      actionsTaken, bannedUsers, warnedUsers, repeatOffenders,
    })
  } catch (err) {
    console.error('[admin/reports/stats GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
