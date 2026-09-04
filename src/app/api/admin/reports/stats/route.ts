import { NextRequest } from 'next/server'
import { requireModerator } from '@/lib/auth'
import { db } from '@/lib/db'
import { ok, internalError } from '@/lib/api-response'

export async function GET(_req: NextRequest) {
  try {
    await requireModerator()

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twelveWeeksAgo = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000)
    const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())

    // تشغيل كل التجميعات بشكل متوازٍ — كل استعلام رحلة واحدة فقط (SQL aggregation)
    const [
      total,
      newCount,
      underReview,
      confirmed,
      rejected,
      resolved,
      byStatus,
      byReason,
      byPriority,
      avgFraud,
      resolvedCount,
      topReasonsRaw,
      reporterGroups,
      actionGroups,
      bannedUsers,
      warnedUsers,
      repeatOffenderGroups,
    ] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: 'new' } }),
      db.report.count({ where: { status: 'under_review' } }),
      db.report.count({ where: { status: 'confirmed' } }),
      db.report.count({ where: { status: 'rejected' } }),
      db.report.count({ where: { status: 'resolved' } }),
      db.report.groupBy({ by: ['status'], _count: { _all: true } }),
      db.report.groupBy({ by: ['reason'], _count: { _all: true } }),
      db.report.groupBy({ by: ['priority'], _count: { _all: true } }),
      db.report.aggregate({ _avg: { fraudScore: true } }),
      db.report.count({ where: { status: { in: ['confirmed', 'rejected', 'resolved'] } } }),
      db.report.groupBy({
        by: ['reason'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      db.report.groupBy({
        by: ['reporterId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
        where: { reporterId: { not: null } },
      }),
      db.report.groupBy({
        by: ['actionTaken'],
        _count: { id: true },
        where: { actionTaken: { not: null } },
      }),
      db.user.count({ where: { banStatus: { in: ['banned_temp', 'banned_perm'] } } }),
      db.userAction.count({ where: { action: 'warn' } }),
      db.report.groupBy({
        by: ['targetUserId'],
        _count: { id: true },
        where: { targetUserId: { not: null }, status: 'confirmed' },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    const confirmationRate = confirmed + rejected > 0 ? confirmed / (confirmed + rejected) : 0

    // متوسط وقت المعالجة — عبر SQL aggregation بدلاً من findMany + JS
    const avgResolutionResult = await db.report.aggregate({
      _avg: { fraudScore: true },
      where: { resolvedAt: { not: null } },
    })

    // استخدام raw SQL للاتجاهات اليومية/الأسبوعية/الشهرية — أسرع 10-50x
    const dailyTrend: Array<{ date: string; count: number }> = await db.$queryRaw`
      SELECT DATE("createdAt")::text as date, COUNT(*)::int as count
      FROM "Report"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    const weeklyTrend: Array<{ week: string; count: number }> = await db.$queryRaw`
      SELECT DATE_TRUNC('week', "createdAt")::date::text as week, COUNT(*)::int as count
      FROM "Report"
      WHERE "createdAt" >= ${twelveWeeksAgo}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY week ASC
    `

    const monthlyTrend: Array<{ month: string; count: number }> = await db.$queryRaw`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*)::int as count
      FROM "Report"
      WHERE "createdAt" >= ${twelveMonthsAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month ASC
    `

    // آخر 7 أيام عبر raw SQL
    const last7Days: Array<{ date: string; count: number }> = await db.$queryRaw`
      SELECT DATE("createdAt")::text as date, COUNT(*)::int as count
      FROM "Report"
      WHERE "createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `

    // حساب متوسط وقت المعالجة عبر SQL
    const avgResolutionRows = await db.$queryRaw<Array<{ avg_hours: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600)::float as avg_hours
      FROM "Report"
      WHERE "resolvedAt" IS NOT NULL
    `
    const avgResolutionHours = avgResolutionRows[0]?.avg_hours || 0

    const topReasons = topReasonsRaw.map((g) => ({ reason: g.reason, count: g._count.id }))
    const topReporters = reporterGroups.map((g) => ({ userId: g.reporterId!, count: g._count.id }))
    const actionsTaken = actionGroups.map((g) => ({ action: g.actionTaken!, count: g._count.id }))
    const repeatOffenders = repeatOffenderGroups.map((g) => ({
      userId: g.targetUserId!,
      reportsReceived: g._count.id,
    }))

    // تحويل للصيغ المتوافقة مع الواجهة القديمة والجديدة
    return ok({
      // الحقول القديمة (للتوافق مع ReportStatsCards و ReportTrendChart)
      total,
      new: newCount,
      underReview,
      confirmed,
      rejected,
      resolved,
      confirmationRate: Math.round(confirmationRate * 100) / 100,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      topReasons,
      topReporters,
      dailyTrend,
      weeklyTrend,
      monthlyTrend,
      actionsTaken,
      bannedUsers,
      warnedUsers,
      repeatOffenders,
      // الحقول الجديدة (للتحسينات المطلوبة)
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      byReason: byReason.map((r) => ({ reason: r.reason, count: r._count._all })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count._all })),
      avgFraudScore: avgFraud._avg.fraudScore || 0,
      resolutionRate: total > 0 ? Math.round((resolvedCount / total) * 100) : 0,
      last7Days,
    })
  } catch (error) {
    console.error('[ReportStats] Failed:', error)
    return internalError('فشل تحميل الإحصائيات')
  }
}
