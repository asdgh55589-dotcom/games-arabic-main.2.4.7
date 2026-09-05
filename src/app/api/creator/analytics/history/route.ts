import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, validationFail } from '@/lib/api-response'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimitMiddleware } from '@/lib/rate-limit'

const RANGES = new Set([7, 30, 90])

// Per-user payload: fail-closed caching posture.
const PRIVATE_NO_STORE = {
  headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' },
} as const

// GET /api/creator/analytics/history?range=7|30|90 — المشاهدات والتحميلات اليومية
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return forbidden('يجب تسجيل الدخول')

    const { searchParams } = new URL(req.url)
    const days = Number.parseInt(searchParams.get('range') || '30', 10)
    if (!RANGES.has(days)) {
      return validationFail('النطاق يجب أن يكون 7 أو 30 أو 90 يوماً')
    }

    const limited = await rateLimitMiddleware(req, {
      limit: 30,
      window: 60,
      keyPrefix: `creator:analytics:${user.id}`,
    })
    if (limited) return limited

    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      select: { id: true },
    })
    const modIds = mods.map((m) => m.id)

    // Calendar-day buckets (UTC, oldest → today), zero-filled.
    const buckets: { date: string; count: number }[] = []
    const indexByDay = new Map<string, number>()
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      indexByDay.set(key, buckets.length)
      buckets.push({ date: key, count: 0 })
    }
    const start = new Date(today.getTime() - (days - 1) * 86400000)

    const viewsBuckets = buckets.map((b) => ({ ...b }))
    const downloadsBuckets = buckets.map((b) => ({ ...b }))

    if (modIds.length > 0) {
      const [viewRows, downloadRows, totalViews, totalDownloads] = await Promise.all([
        db.modView.findMany({
          where: { modId: { in: modIds }, viewedAt: { gte: start } },
          select: { viewedAt: true },
        }),
        db.downloadClick.findMany({
          where: { modId: { in: modIds }, createdAt: { gte: start } },
          select: { createdAt: true },
        }),
        db.modView.count({ where: { modId: { in: modIds }, viewedAt: { gte: start } } }),
        db.downloadClick.count({ where: { modId: { in: modIds }, createdAt: { gte: start } } }),
      ])

      for (const row of viewRows) {
        const idx = indexByDay.get(row.viewedAt.toISOString().slice(0, 10))
        if (idx !== undefined) viewsBuckets[idx].count++
      }
      for (const row of downloadRows) {
        const idx = indexByDay.get(row.createdAt.toISOString().slice(0, 10))
        if (idx !== undefined) downloadsBuckets[idx].count++
      }

      return ok(
        { views: viewsBuckets, downloads: downloadsBuckets, totalViews, totalDownloads },
        PRIVATE_NO_STORE,
      )
    }

    return ok(
      { views: viewsBuckets, downloads: downloadsBuckets, totalViews: 0, totalDownloads: 0 },
      PRIVATE_NO_STORE,
    )
  } catch (err) {
    console.error('[creator/analytics/history GET] failed:', err)
    return internalError('فشل جلب سجل التحليلات')
  }
}
