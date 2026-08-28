import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, internalError } from '@/lib/api-response'

export async function GET() {
  try {
    await requireModerator()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const actions = await db.userAction.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    })

    const cellMap = new Map<string, number>()
    let maxCount = 0

    for (const action of actions) {
      const d = new Date(action.createdAt)
      const day = d.getDay()
      const hour = d.getHours()
      const key = `${day}-${hour}`
      const count = (cellMap.get(key) || 0) + 1
      cellMap.set(key, count)
      if (count > maxCount) maxCount = count
    }

    const data: { day: number; hour: number; count: number }[] = []
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        data.push({
          day,
          hour,
          count: cellMap.get(`${day}-${hour}`) || 0,
        })
      }
    }

    return ok(
      { data, maxCount },
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    )
  } catch (err) {
    console.error('[admin/analytics/heatmap] failed:', err)
    return internalError('Failed to load heatmap analytics')
  }
}
