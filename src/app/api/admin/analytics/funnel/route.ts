import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

const STAGE_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  IN_REVIEW: 'قيد المراجعة',
  APPROVED: 'معتمد',
  PUBLISHED: 'منشور',
  ARCHIVED: 'مؤرشف',
}

const STAGE_ORDER = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']

export async function GET() {
  try {
    await requireModerator()

    // Count mods in each status
    const statusCounts = await db.mod.groupBy({
      by: ['workflowStatus'],
      _count: { id: true },
    })

    const countMap = new Map(statusCounts.map((r) => [r.workflowStatus, r._count.id]))

    // Get workflow transitions for time-in-stage calculation
    const transitions = await db.workflowEntry.findMany({
      orderBy: { changedAt: 'asc' },
      select: { fromStatus: true, toStatus: true, changedAt: true },
    })

    // Calculate avg days in each stage
    const stageTimes = new Map<string, number[]>()
    for (const t of transitions) {
      if (!t.fromStatus) continue
      if (!stageTimes.has(t.fromStatus)) stageTimes.set(t.fromStatus, [])
    }

    // Build stages
    const totalMods = STAGE_ORDER.reduce((sum, s) => sum + (countMap.get(s) || 0), 0)
    let runningCount = totalMods

    const stages = STAGE_ORDER.map((status, idx) => {
      const count = countMap.get(status) || 0
      const conversionRate = runningCount > 0 ? Math.round((count / runningCount) * 100) : 0
      const times = stageTimes.get(status) || []
      const avgDays =
        times.length > 0
          ? Math.round(
              (times.reduce((s, t) => s + t, 0) / times.length / (1000 * 60 * 60 * 24)) * 10,
            ) / 10
          : 0

      runningCount = count // next stage's input

      return {
        name: STAGE_LABELS[status] || status,
        status,
        count,
        conversionRate,
        avgDays,
      }
    })

    return ok({ stages }, { headers: { 'Cache-Control': 'private, max-age=300' } })
  } catch (err) {
    console.error('[admin/analytics/funnel] failed:', err)
    return internalError('Failed to load funnel analytics')
  }
}
